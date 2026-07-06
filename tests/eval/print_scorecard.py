import json
import os
import sys

def print_scorecard():
    scorecard_path = "artifacts/grade_results/scorecard.json"
    if not os.path.exists(scorecard_path):
        print(f"Error: {scorecard_path} not found.")
        sys.exit(1)
        
    with open(scorecard_path, "r") as f:
        try:
            data = json.load(f)
        except Exception as e:
            print(f"Error parsing scorecard JSON: {e}")
            sys.exit(1)
            
    cases = []
    if isinstance(data, list):
        cases = data
    elif isinstance(data, dict):
        cases = data.get("cases", [])
        if not cases:
            for k, v in data.items():
                if isinstance(v, list):
                    cases = v
                    break
                
    if not cases:
        print("Raw Scorecard JSON Data:")
        print(json.dumps(data, indent=2))
        return
        
    print("\n" + "="*70)
    print("  SUPPLY CHAIN RISK AGENT — EVALUATION SCORECARD")
    print("="*70)
    print(f"{'Case ID':<22} | {'Sentiment':<9} | {'Risk Score':<10} | {'Security':<8} | {'Overall':<7}")
    print("-"*70)
    
    sentiment_scores = []
    risk_scores = []
    security_scores = []
    
    reasonings = []
    
    for case in cases:
        case_id = case.get("eval_case_id") or case.get("id") or "unknown"
        metrics = case.get("metrics", {})
        
        # Get metrics
        sent_m = metrics.get("sentiment_accuracy", {})
        risk_m = metrics.get("risk_score_correctness", {})
        sec_m = metrics.get("security_containment", {})
        
        sent_score = sent_m.get("score")
        risk_score = risk_m.get("score")
        sec_score = sec_m.get("score")
        
        # Exclude N/A markers (where score could be N/A string or None)
        if isinstance(sent_score, str):
            sent_score = None
        if isinstance(risk_score, str):
            risk_score = None
        if isinstance(sec_score, str):
            sec_score = None
            
        # Reasonings
        if sent_m.get("explanation"):
            reasonings.append(f"[{case_id}] Sentiment: \"{sent_m['explanation'].strip()}\"")
        if risk_m.get("explanation"):
            reasonings.append(f"[{case_id}] Risk Score: \"{risk_m['explanation'].strip()}\"")
        if sec_m.get("explanation"):
            reasonings.append(f"[{case_id}] Security: \"{sec_m['explanation'].strip()}\"")
            
        sent_str = f"{sent_score}/5" if sent_score is not None else "N/A"
        risk_str = f"{risk_score}/5" if risk_score is not None else "N/A"
        sec_str = f"{sec_score}/5" if sec_score is not None else "N/A"
        
        if sent_score is not None:
            sentiment_scores.append(float(sent_score))
        if risk_score is not None:
            risk_scores.append(float(risk_score))
        if sec_score is not None:
            security_scores.append(float(sec_score))
            
        # Determine overall pass (PASS if all metrics are >= 3 or None/N/A)
        passed = True
        for score in [sent_score, risk_score, sec_score]:
            if score is not None and float(score) < 3.0:
                passed = False
                break
        overall = "PASS" if passed else "FAIL"
        
        print(f"{case_id:<22} | {sent_str:<9} | {risk_str:<10} | {sec_str:<8} | {overall:<7}")
        
    print("-"*70)
    avg_sent = f"{sum(sentiment_scores)/len(sentiment_scores):.1f}/5" if sentiment_scores else "N/A"
    avg_risk = f"{sum(risk_scores)/len(risk_scores):.1f}/5" if risk_scores else "N/A"
    avg_sec = f"{sum(security_scores)/len(security_scores):.1f}/5" if security_scores else "N/A"
    print(f"{'Average':<22} | {avg_sent:<9} | {avg_risk:<10} | {avg_sec:<8} |")
    print("="*70)
    
    print("\nPer-case reasoning:")
    for r in reasonings:
        print(r)
    print()

if __name__ == "__main__":
    print_scorecard()
