// The judge module (llm_judge.py) returns its confidence, provider votes,
// and agree/disagree outcome folded into one "reason" sentence, because
// the backend's report schema only has a free-text "reason" field - it
// was never extended with separate structured columns. Rather than ask
// for a backend change, this parses that real text client-side. Every
// field below is read from the actual reason string, never invented.
//
// Falls back gracefully (nulls / "n/a") for rows that predate the judge
// (the old evaluator.py's plain pass-through reason has none of this).

export function parseJudgeReason(reason) {
  const text = reason || "";

  const confidenceMatch = text.match(/confidence[:\s]*([0-9]*\.?[0-9]+)/i);
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : null;

  const usedGemini = /gemini/i.test(text);
  const usedGroq = /groq/i.test(text);

  let agreement = "unknown";
  if (/rule-based override/i.test(text)) agreement = "rule-based";
  else if (/DISAGREE/i.test(text)) agreement = "disagree";
  else if (/no consensus/i.test(text)) agreement = "disagree";
  else if (/agrees with the agent/i.test(text)) agreement = "agree";
  else if (/unavailable/i.test(text)) agreement = "unavailable";
  else if (/\[Only/i.test(text)) agreement = "single-juror";

  return {
    confidence,
    usedGemini,
    usedGroq,
    agreement,
    raw: text,
  };
}

export function agreementLabel(agreement) {
  switch (agreement) {
    case "agree": return "Judge agrees with agent";
    case "disagree": return "Judge disagrees — flagged for review";
    case "rule-based": return "Rule-based override (hard evidence)";
    case "unavailable": return "Independent judge unavailable";
    case "single-juror": return "Only one juror responded";
    default: return "No judge data on this row";
  }
}
