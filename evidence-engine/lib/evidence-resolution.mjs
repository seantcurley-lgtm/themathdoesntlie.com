/**
 * Governed evidence resolution for facts not established through SEC Company Facts.
 *
 * Source order implemented here:
 *   1. SEC Company Facts (handled by sec-xbrl.mjs)
 *   2. Official Inline XBRL filing presentation
 *   3. Filed statements and notes embedded in that Inline XBRL document
 *
 * The resolver never estimates a value. Exact approved taxonomy concepts may be
 * accepted automatically. Issuer extensions and competing facts become a
 * ReviewRequired case and require an explicit, fingerprinted human decision.
 */

import {
  ALIAS_REGISTRY_VERSION,
  filingResolutionPolicies,
} from "./alias-registry.mjs";

export { filingResolutionPolicies } from "./alias-registry.mjs";

export const EVIDENCE_RESOLUTION_VERSION = "1.5.0";

export const REVIEW_DECISION_ACTIONS = Object.freeze({
  ACCEPT_CANDIDATE: "AcceptCandidate",
  AGGREGATE_CANDIDATES: "AggregateCandidates",
  REJECT_ALL_NOT_REPORTED_ZERO: "RejectAllNotReportedZero",
});

// CE-105 explicitly authorizes component assembly for Total Debt. CE-103
// defers multi-class share normalization to future governance, so shares may
// be reviewed individually but cannot be summed under the current policy.
const aggregatableFields = new Set(["totalDebt"]);

function allowedDecisionActions(resolutionPolicy) {
  return [
    REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE,
    ...(aggregatableFields.has(resolutionPolicy.field)
      ? [REVIEW_DECISION_ACTIONS.AGGREGATE_CANDIDATES]
      : []),
    ...(resolutionPolicy.optionalIfNotReported
      ? [REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO]
      : []),
  ];
}

const MILLION = 1_000_000;

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return String(value ?? "").replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity) => {
      if (entity[0] === "#") {
        const numeric = entity[1]?.toLowerCase() === "x"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : match;
      }
      return named[entity.toLowerCase()] ?? match;
    },
  );
}

function attributesFrom(text) {
  const attributes = {};
  const pattern = /([:\w.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = pattern.exec(text))) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? "");
  }
  return attributes;
}

function tagText(text) {
  return decodeEntities(String(text ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function firstTagText(text, localName) {
  const pattern = new RegExp(
    `<(?:[a-z0-9_-]+:)?${localName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${localName}\\s*>`,
    "i",
  );
  return tagText(pattern.exec(text)?.[1] ?? "");
}

function durationDays(start, end) {
  if (!start || !end) return Number.POSITIVE_INFINITY;
  return Math.abs(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000,
  );
}

export function resolveReportingPeriodStartFromFiling(html, filing) {
  const eligible = extractInlineXbrlFacts(html).filter((fact) =>
    Boolean(fact.start) &&
    fact.end === filing.reportDate &&
    durationDays(fact.start, fact.end) >= 300 &&
    durationDays(fact.start, fact.end) <= 400,
  );
  if (!eligible.length) return null;
  const groups = new Map();
  for (const fact of eligible) {
    const group = groups.get(fact.start) ?? { start: fact.start, facts: [], nonDimensionalFacts: [] };
    group.facts.push(fact);
    if (!fact.hasDimensions) group.nonDimensionalFacts.push(fact);
    groups.set(fact.start, group);
  }
  const selected = [...groups.values()].sort((left, right) =>
    right.nonDimensionalFacts.length - left.nonDimensionalFacts.length ||
    right.facts.length - left.facts.length ||
    String(left.start).localeCompare(String(right.start)),
  )[0];
  const representative = selected.nonDimensionalFacts[0] ?? selected.facts[0];
  return {
    start: selected.start,
    end: filing.reportDate,
    factsExamined: eligible.length,
    supportingFactCount: selected.facts.length,
    nonDimensionalFactCount: selected.nonDimensionalFacts.length,
    representative,
  };
}

function numericFactValue(text, attributes) {
  if (/^(true|1)$/i.test(attributes["xsi:nil"] ?? attributes.nil ?? "")) return null;
  const cleaned = tagText(text)
    .replace(/[,$£€¥\s]/g, "")
    .replace(/[−–—]/g, "-");
  if (!cleaned || /^[-—–]$/.test(cleaned)) return null;
  const parenthesized = /^\(.*\)$/.test(cleaned);
  const numeric = Number(parenthesized ? cleaned.slice(1, -1) : cleaned);
  if (!Number.isFinite(numeric)) return null;
  const scale = Number(attributes.scale ?? 0);
  if (!Number.isInteger(scale) || Math.abs(scale) > 18) return null;
  const sign = attributes.sign === "-" || parenthesized ? -1 : 1;
  return numeric * (10 ** scale) * sign;
}

function conceptParts(name) {
  const parts = String(name ?? "").split(":");
  return {
    taxonomy: parts.length > 1 ? parts[0].toLowerCase() : "",
    concept: parts.at(-1) ?? "",
  };
}

export function extractInlineXbrlFacts(html) {
  const contexts = new Map();
  const contextPattern = /<(?:[a-z0-9_-]+:)?context\b([^>]*)>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?context\s*>/gi;
  let contextMatch;
  while ((contextMatch = contextPattern.exec(String(html ?? "")))) {
    const attributes = attributesFrom(contextMatch[1]);
    const id = attributes.id;
    if (!id) continue;
    const body = contextMatch[2];
    const instant = firstTagText(body, "instant");
    contexts.set(id, {
      id,
      start: firstTagText(body, "startdate") || null,
      end: firstTagText(body, "enddate") || instant || null,
      instant: Boolean(instant),
      hasDimensions: /<(?:[a-z0-9_-]+:)?(?:explicitmember|typedmember)\b/i.test(body),
    });
  }

  const facts = [];
  const factPattern = /<(?:[a-z0-9_-]+:)?nonfraction\b([^>]*)>([\s\S]*?)<\/(?:[a-z0-9_-]+:)?nonfraction\s*>/gi;
  let factMatch;
  while ((factMatch = factPattern.exec(String(html ?? "")))) {
    const attributes = attributesFrom(factMatch[1]);
    const value = numericFactValue(factMatch[2], attributes);
    const context = contexts.get(attributes.contextref);
    if (!attributes.name || value === null || !context?.end) continue;
    const { taxonomy, concept } = conceptParts(attributes.name);
    facts.push({
      id: attributes.id || null,
      name: attributes.name,
      taxonomy,
      concept,
      contextRef: attributes.contextref,
      unitRef: attributes.unitref || null,
      format: attributes.format || null,
      scale: attributes.scale || "0",
      sign: attributes.sign || null,
      reportedText: tagText(factMatch[2]),
      sourceValue: value,
      start: context.start,
      end: context.end,
      instant: context.instant,
      hasDimensions: context.hasDimensions,
    });
  }
  return facts;
}

function periodEligible(fact, resolutionPolicy, filing) {
  if (resolutionPolicy.periodMode === "duration") {
    const days = durationDays(fact.start, fact.end);
    return Boolean(fact.start) && fact.end === filing.reportDate && days >= 300 && days <= 400;
  }
  if (resolutionPolicy.periodMode === "ending") {
    return fact.instant && fact.end === filing.reportDate;
  }
  if (resolutionPolicy.periodMode === "beginning") {
    return fact.instant && fact.end < filing.reportDate;
  }
  if (resolutionPolicy.periodMode === "cover") {
    return fact.instant && fact.end >= filing.reportDate && fact.end <= filing.filingDate;
  }
  return false;
}

function normalizedValue(fact, resolutionPolicy) {
  let value = fact.sourceValue;
  if (resolutionPolicy.absolute) value = Math.abs(value);
  if (resolutionPolicy.scale === "millions" || resolutionPolicy.scale === "shares") {
    value /= MILLION;
  }
  return value;
}

function candidateFromFact(field, fact, resolutionPolicy, filing, index) {
  const exactConcept = resolutionPolicy.concepts.includes(fact.concept);
  const exactTaxonomy = fact.taxonomy === resolutionPolicy.taxonomy;
  const automaticEligible = exactConcept && exactTaxonomy && !fact.hasDimensions;
  const reviewConcept = resolutionPolicy.reviewConcepts?.includes(fact.concept);
  const confidence = automaticEligible && reviewConcept
    ? "Review"
    : automaticEligible
      ? resolutionPolicy.confidence
      : "Review";
  const sourceLocation = fact.id ? `${filing.filingUrl}#${fact.id}` : filing.filingUrl;
  const value = normalizedValue(fact, resolutionPolicy);
  return {
    id: `${field}:${fact.name}:${fact.contextRef}:${fact.id ?? index}:${value}`,
    field,
    taxonomy: fact.taxonomy,
    concept: fact.concept,
    qualifiedConcept: fact.name,
    reportedText: fact.reportedText,
    reportedValue: fact.sourceValue,
    normalizedValue: value,
    displayUnit:
      resolutionPolicy.scale === "per-share"
        ? "USD/share"
        : resolutionPolicy.scale === "shares"
          ? "millions of shares"
          : "USD millions",
    unitRef: fact.unitRef,
    start: fact.start,
    end: fact.end,
    contextRef: fact.contextRef,
    hasDimensions: fact.hasDimensions,
    sourceUrl: filing.filingUrl,
    sourceLocation,
    filed: filing.filingDate,
    accessionNumber: filing.accessionNumber,
    form: filing.form,
    automaticEligible,
    confidence,
    reason: automaticEligible
      ? reviewConcept
        ? resolutionPolicy.reviewRationale
        : "Exact approved taxonomy concept in an eligible non-dimensional filing context."
      : fact.hasDimensions
        ? "A dimensioned filing fact requires human confirmation of the intended consolidated scope."
        : "An issuer extension or non-canonical concept requires semantic review before acceptance.",
  };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = [
      candidate.qualifiedConcept,
      candidate.normalizedValue,
      candidate.start,
      candidate.end,
      candidate.hasDimensions,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function candidatesForField(facts, resolutionPolicy, filing) {
  const candidates = facts
    .filter((fact) => periodEligible(fact, resolutionPolicy, filing))
    .filter((fact) => {
      const exact = resolutionPolicy.concepts.includes(fact.concept);
      const patternMatch = resolutionPolicy.candidatePatterns.some((pattern) => pattern.test(fact.concept));
      const excluded = resolutionPolicy.excludedPatterns.some((pattern) => pattern.test(fact.concept));
      return (exact || patternMatch) && !excluded;
    })
    .map((fact, index) => candidateFromFact(resolutionPolicy.field, fact, resolutionPolicy, filing, index));

  const deduped = dedupeCandidates(candidates);
  if (resolutionPolicy.periodMode === "beginning" && deduped.length) {
    const latestPrior = deduped.map((item) => item.end).sort().at(-1);
    return deduped.filter((item) => item.end === latestPrior).slice(0, 12);
  }
  if (resolutionPolicy.periodMode === "cover" && deduped.length) {
    const latestCover = deduped.map((item) => item.end).sort().at(-1);
    return deduped.filter((item) => item.end === latestCover).slice(0, 12);
  }
  return deduped.slice(0, 12);
}

function recoveredEvidence(existingEvidence, candidate, resolutionPolicy, filing) {
  return {
    ...existingEvidence,
    status: resolutionPolicy.confidence === "Review" ? "Review" : "Mapped",
    confidence: resolutionPolicy.confidence,
    value: candidate.normalizedValue,
    displayUnit: candidate.displayUnit,
    taxonomy: candidate.taxonomy,
    concept: candidate.concept,
    conceptLabel: candidate.concept,
    reportedUnit: candidate.unitRef,
    reportedValue: candidate.reportedValue,
    start: candidate.start,
    end: candidate.end,
    filed: filing.filingDate,
    accessionNumber: filing.accessionNumber,
    form: filing.form,
    method: "inline-xbrl-reported",
    reason:
      resolutionPolicy.rationale ??
      "Recovered from an exact approved concept in the official Inline XBRL filing after Company Facts did not establish the field.",
    sourceType: "SEC Inline XBRL filing",
    sourceUrl: candidate.sourceUrl,
    sourceLocation: candidate.sourceLocation,
    candidateId: candidate.id,
    resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
    priorEvidence: existingEvidence,
  };
}

export function resolveMissingFilingEvidence({
  html,
  filing,
  inputs,
  evidence,
  collectionError = null,
}) {
  const unresolvedFields = Object.keys(evidence).filter(
    (field) => evidence[field]?.status === "Missing" && filingResolutionPolicies[field],
  );
  const attemptedSources = [
    "SEC Company Facts",
    "Official Inline XBRL filing presentation",
    "Filed financial statements and notes embedded in the filing",
  ];
  const cases = [];
  let resolvedFromFiling = 0;

  if (collectionError || !html) {
    for (const field of unresolvedFields) {
      evidence[field] = {
        ...evidence[field],
        status: "CollectionFailure",
        method: "filing-fallback-unavailable",
        reason: `The official filing fallback could not be acquired or processed: ${collectionError ?? "empty filing response"}`,
        resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
      };
      cases.push({
        field,
        label: evidence[field].label,
        outcome: "CollectionFailure",
        candidates: [],
        attemptedSources,
        reason: evidence[field].reason,
      });
    }
    return {
      version: EVIDENCE_RESOLUTION_VERSION,
      aliasRegistryVersion: ALIAS_REGISTRY_VERSION,
      status: unresolvedFields.length ? "CollectionFailure" : "NotNeeded",
      resolvedFromFiling,
      cases,
      factsExamined: 0,
      attemptedSources,
    };
  }

  const facts = extractInlineXbrlFacts(html);
  for (const field of unresolvedFields) {
    const resolutionPolicy = filingResolutionPolicies[field];
    const candidates = candidatesForField(facts, resolutionPolicy, filing);
    const automaticCandidates = candidates.filter((candidate) => candidate.automaticEligible);

    if (automaticCandidates.length === 1) {
      const selected = automaticCandidates[0];
      inputs[field] = selected.normalizedValue;
      evidence[field] = recoveredEvidence(evidence[field], selected, resolutionPolicy, filing);
      resolvedFromFiling += 1;
      cases.push({
        field,
        label: evidence[field].label,
        outcome: "MappedFallback",
        selectedCandidateId: selected.id,
        candidates,
        attemptedSources,
        reason: evidence[field].reason,
      });
      continue;
    }

    if (candidates.length) {
      evidence[field] = {
        ...evidence[field],
        status: "ReviewRequired",
        confidence: "Review",
        method: "inline-xbrl-candidates",
        reason: `${candidates.length} official filing candidate${candidates.length === 1 ? " requires" : "s require"} governed semantic review before this field can be accepted.`,
        resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
        candidateIds: candidates.map((candidate) => candidate.id),
      };
      cases.push({
        field,
        label: evidence[field].label,
        outcome: "ReviewRequired",
        candidates,
        allowedDecisionActions: allowedDecisionActions(resolutionPolicy),
        attemptedSources,
        reason: evidence[field].reason,
      });
      continue;
    }

    evidence[field] = {
      ...evidence[field],
      status: "Missing",
      method: "source-hierarchy-exhausted",
      reason:
        "Company Facts and the official Inline XBRL filing, statements, and notes were reviewed; no eligible reported fact was found.",
      resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
    };
    cases.push({
      field,
      label: evidence[field].label,
      outcome: "MissingEvidence",
      candidates: [],
      attemptedSources,
      reason: evidence[field].reason,
    });
  }

  return {
    version: EVIDENCE_RESOLUTION_VERSION,
    aliasRegistryVersion: ALIAS_REGISTRY_VERSION,
    status: cases.some((item) => item.outcome === "ReviewRequired")
      ? "ReviewRequired"
      : "Complete",
    resolvedFromFiling,
    cases,
    factsExamined: facts.length,
    attemptedSources,
  };
}

function validDecisionAudit(decision) {
  return Boolean(
    String(decision?.reviewer ?? "").trim() &&
      String(decision.rationale ?? "").trim() &&
      decision.reviewedAt &&
      !Number.isNaN(Date.parse(decision.reviewedAt)),
  );
}

function decisionAction(decision) {
  return decision?.action ?? REVIEW_DECISION_ACTIONS.ACCEPT_CANDIDATE;
}

function selectedIds(decision) {
  if (Array.isArray(decision?.selectedCandidateIds)) {
    return [...new Set(decision.selectedCandidateIds.filter(Boolean))];
  }
  return decision?.selectedCandidateId ? [decision.selectedCandidateId] : [];
}

function replaceResolutionDecision(next, field, reviewDecision) {
  next.resolutionDecisions = next.resolutionDecisions.filter((item) => item.field !== field);
  next.resolutionDecisions.push({ field, ...reviewDecision });
}

export function applyEvidenceResolutionDecisions(inputs, decisions = []) {
  const next = {
    ...inputs,
    inputEvidence: { ...(inputs.inputEvidence ?? {}) },
    resolutionDecisions: [...(inputs.resolutionDecisions ?? [])],
  };
  const cases = inputs.evidenceResolutionCases ?? [];
  const applied = [];
  const errors = [];

  for (const decision of decisions) {
    const resolutionCase = cases.find((item) => item.field === decision.field);
    const action = decisionAction(decision);
    const policy = filingResolutionPolicies[decision.field];
    if (!resolutionCase || resolutionCase.outcome !== "ReviewRequired" || !policy) {
      errors.push({ field: decision.field, reason: "The filing review case is not available." });
      continue;
    }
    if (!validDecisionAudit(decision)) {
      errors.push({
        field: decision.field,
        reason: "Reviewer, timestamp, and rationale are required.",
      });
      continue;
    }

    const policyActions = allowedDecisionActions(policy);
    const allowedActions = (resolutionCase.allowedDecisionActions ?? policyActions)
      .filter((item) => policyActions.includes(item));
    if (!allowedActions.includes(action)) {
      errors.push({ field: decision.field, reason: `${action} is not permitted for this governed field.` });
      continue;
    }

    const existingEvidence = next.inputEvidence[decision.field] ?? {};
    const candidateRecordsExamined = resolutionCase.candidates.map((item) => item.id);

    if (action === REVIEW_DECISION_ACTIONS.REJECT_ALL_NOT_REPORTED_ZERO) {
      const reviewDecision = {
        decision: "RejectedAllNotReportedZero",
        reviewer: String(decision.reviewer).trim(),
        reviewedAt: decision.reviewedAt,
        rationale: String(decision.rationale).trim(),
        selectedCandidateId: null,
        selectedCandidateIds: [],
        candidateRecordsExamined,
        supportingSourceLocation: resolutionCase.candidates[0]?.sourceUrl ?? null,
        supportingSourceLocations: [...new Set(resolutionCase.candidates.map((item) => item.sourceLocation))],
        reviewPolicyVersion: EVIDENCE_RESOLUTION_VERSION,
      };
      next[decision.field] = 0;
      next.inputEvidence[decision.field] = {
        ...existingEvidence,
        status: "NotReported",
        confidence: "GovernedReview",
        value: 0,
        displayUnit: existingEvidence.displayUnit ?? "USD millions",
        taxonomy: null,
        concept: null,
        conceptLabel: null,
        reportedUnit: null,
        reportedValue: null,
        method: "manual-review-rejected-all-optional-zero",
        reason: `All filing candidates were rejected after governed review; the optional CE component is not separately reported: ${reviewDecision.rationale}`,
        sourceType: "SEC Inline XBRL filing",
        sourceUrl: resolutionCase.candidates[0]?.sourceUrl ?? null,
        sourceLocation: resolutionCase.candidates[0]?.sourceUrl ?? null,
        priorEvidence: existingEvidence,
        reviewDecision,
        resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
      };
      replaceResolutionDecision(next, decision.field, reviewDecision);
      applied.push(decision.field);
      continue;
    }

    const ids = selectedIds(decision);
    const candidates = ids.map((id) => resolutionCase.candidates.find((item) => item.id === id));
    if (!ids.length || candidates.some((item) => !item)) {
      errors.push({ field: decision.field, reason: "Every selected filing candidate must be available in this review case." });
      continue;
    }

    if (action === REVIEW_DECISION_ACTIONS.AGGREGATE_CANDIDATES) {
      if (candidates.length < 2) {
        errors.push({ field: decision.field, reason: "Aggregation requires at least two filing candidates." });
        continue;
      }
      const reference = candidates[0];
      const compatible = candidates.every((candidate) =>
        candidate.displayUnit === reference.displayUnit &&
        candidate.end === reference.end &&
        candidate.accessionNumber === reference.accessionNumber,
      );
      if (!compatible) {
        errors.push({ field: decision.field, reason: "Aggregated candidates must share the same unit, period end, and filing accession." });
        continue;
      }
      const value = candidates.reduce((sum, candidate) => sum + candidate.normalizedValue, 0);
      const reviewDecision = {
        decision: "Aggregated",
        aggregationMethod: "Sum",
        reviewer: String(decision.reviewer).trim(),
        reviewedAt: decision.reviewedAt,
        rationale: String(decision.rationale).trim(),
        selectedCandidateId: null,
        selectedCandidateIds: ids,
        candidateRecordsExamined,
        supportingSourceLocation: reference.sourceUrl,
        supportingSourceLocations: candidates.map((item) => item.sourceLocation),
        reviewPolicyVersion: EVIDENCE_RESOLUTION_VERSION,
      };
      next[decision.field] = value;
      next.inputEvidence[decision.field] = {
        ...existingEvidence,
        status: "Review",
        confidence: "GovernedReview",
        value,
        displayUnit: reference.displayUnit,
        taxonomy: "aggregated",
        concept: candidates.map((item) => item.qualifiedConcept).join(" + "),
        conceptLabel: "Governed sum of filing candidates",
        reportedUnit: reference.unitRef,
        reportedValue: null,
        start: reference.start,
        end: reference.end,
        filed: reference.filed,
        accessionNumber: reference.accessionNumber,
        form: reference.form,
        method: "manual-review-aggregated-sum",
        reason: `Aggregated after governed review: ${reviewDecision.rationale}`,
        sourceType: "SEC Inline XBRL filing",
        sourceUrl: reference.sourceUrl,
        sourceLocation: reference.sourceUrl,
        priorEvidence: existingEvidence,
        reviewDecision,
        resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
      };
      replaceResolutionDecision(next, decision.field, reviewDecision);
      applied.push(decision.field);
      continue;
    }

    if (ids.length !== 1) {
      errors.push({ field: decision.field, reason: "Candidate acceptance requires exactly one selected filing candidate." });
      continue;
    }
    const candidate = candidates[0];
    const reviewDecision = {
      decision: "Accepted",
      reviewer: String(decision.reviewer).trim(),
      reviewedAt: decision.reviewedAt,
      rationale: String(decision.rationale).trim(),
      selectedCandidateId: candidate.id,
      selectedCandidateIds: [candidate.id],
      candidateRecordsExamined,
      supportingSourceLocation: candidate.sourceLocation,
      supportingSourceLocations: [candidate.sourceLocation],
      reviewPolicyVersion: EVIDENCE_RESOLUTION_VERSION,
    };
    next[decision.field] = candidate.normalizedValue;
    next.inputEvidence[decision.field] = {
      ...existingEvidence,
      status: "Review",
      confidence: "GovernedReview",
      value: candidate.normalizedValue,
      displayUnit: candidate.displayUnit,
      taxonomy: candidate.taxonomy,
      concept: candidate.concept,
      conceptLabel: candidate.concept,
      reportedUnit: candidate.unitRef,
      reportedValue: candidate.reportedValue,
      start: candidate.start,
      end: candidate.end,
      filed: candidate.filed,
      accessionNumber: candidate.accessionNumber,
      form: candidate.form,
      method: "manual-review-approved",
      reason: `Accepted after governed review: ${reviewDecision.rationale}`,
      sourceType: "SEC Inline XBRL filing",
      sourceUrl: candidate.sourceUrl,
      sourceLocation: candidate.sourceLocation,
      priorEvidence: existingEvidence,
      reviewDecision,
      resolutionVersion: EVIDENCE_RESOLUTION_VERSION,
    };
    replaceResolutionDecision(next, decision.field, reviewDecision);
    applied.push(decision.field);
  }

  return { inputs: next, applied, errors };
}
