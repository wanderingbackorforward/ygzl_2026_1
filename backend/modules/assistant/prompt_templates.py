# -*- coding: utf-8 -*-
"""
Prompt templates for different intent types
Each template is optimized for a specific type of question
"""

from .intent_classifier import (
    INTENT_DATA_QUERY,
    INTENT_ANOMALY_CHECK,
    INTENT_TREND_ANALYSIS,
    INTENT_COMPARISON,
    INTENT_PREDICTION,
    INTENT_EXPLANATION,
    INTENT_OPERATION,
    INTENT_GENERAL,
)


INTENT_TEMPLATES = {
    INTENT_DATA_QUERY: """You are answering a DATA QUERY question.

Focus on:
- Extract specific values from the page context
- Cite exact numbers with units
- Present data in a clear, structured format
- Use tables when comparing multiple values

Response format:
### Data Summary
- [Key metric]: [Value] [Unit]
- [Key metric]: [Value] [Unit]

### Details
[Additional context if needed]

Output in Chinese. Be precise and concise.
""",

    INTENT_ANOMALY_CHECK: """You are answering an ANOMALY CHECK question.

Focus on:
- Identify all anomalies from the page context
- Classify by severity (Critical/High/Medium/Low)
- Explain why each item is considered anomalous
- Provide specific threshold violations

Response format:
### Anomaly Summary
Total: X anomalies detected
- Critical: X
- High: X
- Medium: X

### Critical Anomalies
1. **[Point ID]**: [Issue description]
   - Current value: [Value]
   - Threshold: [Value]
   - Deviation: [Percentage]

### Recommendations
- [Action 1]
- [Action 2]

Output in Chinese. Prioritize by severity.
""",

    INTENT_TREND_ANALYSIS: """You are answering a TREND ANALYSIS question.

Focus on:
- Describe overall trend (increasing/decreasing/stable/fluctuating)
- Quantify the rate of change
- Identify trend patterns (linear/exponential/seasonal)
- Highlight significant changes or inflection points

Response format:
### Trend Overview
Overall trend: [Description]
Rate of change: [Value] per [time unit]

### Key Observations
- [Observation 1]
- [Observation 2]

### Trend Patterns
[Describe patterns with data support]

Output in Chinese. Use data to support conclusions.
""",

    INTENT_COMPARISON: """You are answering a COMPARISON question.

Focus on:
- Compare specific data points or groups
- Highlight similarities and differences
- Quantify the differences (absolute and percentage)
- Use tables for side-by-side comparison

Response format:
### Comparison Summary
[Brief overview of what is being compared]

### Comparison Table
| Item | Metric 1 | Metric 2 | Difference |
|------|----------|----------|------------|
| A    | [Value]  | [Value]  | [Value]    |
| B    | [Value]  | [Value]  | [Value]    |

### Key Differences
- [Difference 1]
- [Difference 2]

Output in Chinese. Use clear metrics.
""",

    INTENT_PREDICTION: """You are answering a PREDICTION question.

Focus on:
- Base predictions on historical trends from context
- Provide confidence levels or ranges
- Explain the basis for predictions
- Mention limitations and uncertainties

Response format:
### Prediction
Expected value: [Value] ± [Range]
Timeframe: [Time period]
Confidence: [High/Medium/Low]

### Basis
- Historical trend: [Description]
- Current rate: [Value]
- Contributing factors: [List]

### Uncertainties
- [Factor 1]
- [Factor 2]

Output in Chinese. Be clear about confidence levels.
""",

    INTENT_EXPLANATION: """You are answering an EXPLANATION question.

Focus on:
- Explain the mechanism or cause
- Use simple, clear language
- Provide examples from the context
- Break down complex concepts into steps

Response format:
### Explanation
[Clear, concise explanation]

### Mechanism
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Example from Current Data
[Concrete example using page context]

### Related Factors
- [Factor 1]
- [Factor 2]

Output in Chinese. Make it easy to understand.
""",

    INTENT_OPERATION: """You are answering an OPERATIONAL GUIDANCE question.

Focus on:
- Provide clear, actionable steps
- Prioritize safety considerations
- Be specific and practical
- Include what to do and what NOT to do

Response format:
### Immediate Actions
1. [Action 1]
2. [Action 2]
3. [Action 3]

### Safety Considerations
- [Safety point 1]
- [Safety point 2]

### What NOT to Do
- [Avoid 1]
- [Avoid 2]

### Follow-up
[Next steps after immediate actions]

Output in Chinese. Be clear and direct.
""",

    INTENT_GENERAL: """You are answering a GENERAL question.

Focus on:
- Understand the user's intent
- Provide helpful, relevant information
- Use context from the page if available
- Be conversational but professional

Response format:
[Flexible format based on question]

Output in Chinese. Be helpful and clear.
""",
}


def get_intent_template(intent: str) -> str:
    """
    Get prompt template for a specific intent

    Args:
        intent: Intent type

    Returns:
        Prompt template string
    """
    return INTENT_TEMPLATES.get(intent, INTENT_TEMPLATES[INTENT_GENERAL])


def build_system_prompt(role: str, intent: str, base_prompt: str) -> str:
    """
    Build complete system prompt by combining role prompt and intent template

    Args:
        role: User role (researcher/worker/reporter)
        intent: Question intent type
        base_prompt: Base role prompt

    Returns:
        Complete system prompt
    """
    intent_template = get_intent_template(intent)

    # Combine base prompt with intent-specific instructions
    combined_prompt = f"""{base_prompt}

---

INTENT-SPECIFIC INSTRUCTIONS:
{intent_template}
"""

    return combined_prompt
