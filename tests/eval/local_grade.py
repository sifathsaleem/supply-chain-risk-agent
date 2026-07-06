import os
import json
import asyncio
from google import genai
from google.genai import types

# Initialize the Gemini Client using standard GenAI client
client = genai.Client()

async def grade_metric(metric_name, prompt_template, prompt_val, response_val):
    # Formulate system/user prompt
    prompt = prompt_template.replace("{prompt}", prompt_val).replace("{response}", response_val)
    
    # Configure generation options for structured JSON output
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema={
            "type": "OBJECT",
            "properties": {
                "score": {"type": "INTEGER"},
                "explanation": {"type": "STRING"}
            },
            "required": ["score", "explanation"]
        },
        temperature=0.0
    )
    
    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config=config
        )
        # Sleep for 5 seconds to comply with Free Tier rate limit of 15 RPM / 5 RPM
        await asyncio.sleep(5.0)
        result = json.loads(response.text)
        return result
    except Exception as e:
        print(f"Error grading {metric_name}: {e}")
        # Sleep on failure too
        await asyncio.sleep(5.0)
        return {"score": 1, "explanation": f"Failed to grade: {e}"}

async def grade_all():
    report_path = "artifacts/traces/comparison_report.json"
    if not os.path.exists(report_path):
        print(f"Error: {report_path} not found. Please run generate_traces.py first.")
        return
        
    with open(report_path, "r") as f:
        report = json.load(f)
        
    # Read metrics config
    config_path = "tests/eval/eval_config.yaml"
    import yaml
    with open(config_path, "r") as f:
        eval_config = yaml.safe_load(f)
        
    metrics = {m["name"]: m["prompt_template"] for m in eval_config["custom_metrics"]}
    
    cases = report["cases"]
    scorecard = []
    
    print("Grading evaluation traces using Gemini...")
    for case in cases:
        case_id = case["id"]
        print(f"  Grading case: {case_id}...")
        
        prompt_val = json.dumps(case["expected"].get("input") or case["expected"])
        response_val = json.dumps({
            "nodes_executed": case["actual"]["nodes_executed"],
            "nodes_skipped": case["actual"]["nodes_skipped"],
            "llm_called": case["actual"]["llm_called"],
            "llm_call_count": case["actual"]["llm_call_count"],
            "sentiment": case["actual"]["sentiment"],
            "confidence": case["actual"]["confidence"],
            "risk_level": case["actual"]["risk_level"],
            "risk_score": case["actual"]["risk_score"],
            "summary": case["actual"]["summary"],
            "alert_message": case["actual"]["alert_message"],
            "error": case["actual"]["error"]
        })
        
        case_metrics = {}
        for m_name, m_template in metrics.items():
            res = await grade_metric(m_name, m_template, prompt_val, response_val)
            case_metrics[m_name] = res
            
        scorecard.append({
            "eval_case_id": case_id,
            "metrics": case_metrics
        })
        
    os.makedirs("artifacts/grade_results", exist_ok=True)
    scorecard_path = "artifacts/grade_results/scorecard.json"
    with open(scorecard_path, "w") as f:
        json.dump(scorecard, f, indent=2)
        
    print(f"\nSuccessfully graded all cases. Scorecard saved to: {scorecard_path}\n")

if __name__ == "__main__":
    asyncio.run(grade_all())
