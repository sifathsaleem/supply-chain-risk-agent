import datetime
from zoneinfo import ZoneInfo

from google.adk.agents import LlmAgent
from google.adk.apps import App
from google.adk.models import Gemini
from google.adk.workflow import Workflow, node
from google.adk.agents.context import Context
from google.adk.events.request_input import RequestInput
from google.adk.events.event import Event
from pydantic import BaseModel
import os

class AnalysisOutput(BaseModel):
    summary: str
    risk_level: str
    recommendation: str

# LlmAgent acting as a node in the workflow
analyzer = LlmAgent(
    name="analyzer",
    model=Gemini(model="gemini-3.1-flash-lite"),
    instruction="""You are a supply chain risk analyst.
    Analyze the user's input to identify potential risks, determine a risk level (Low, Medium, High),
    and provide a recommendation.""",
    output_schema=AnalysisOutput,
    output_key="analysis"
)

# Human-in-the-loop node using RequestInput
@node
async def human_review(ctx: Context, node_input: dict):
    # LlmAgent with output_schema outputs a dict representing the parsed JSON
    if not ctx.resume_inputs:
        summary = node_input.get("summary", "No summary")
        risk_level = node_input.get("risk_level", "Unknown")
        
        # Yield RequestInput to pause and ask for human confirmation
        yield RequestInput(
            interrupt_id="ask_approval", 
            message=f"Risk Level identified as {risk_level}.\nSummary: {summary}\nDo you approve this analysis? (Yes/No)"
        )
        return
    
    # Resume after human provides input
    approval = ctx.resume_inputs["ask_approval"]
    final_output = {
        "original_analysis": node_input,
        "human_approval": approval,
        "status": "Approved" if "yes" in approval.lower() else "Rejected"
    }
    
    # Emits Event to output the final result
    yield Event(output=final_output)

# The new ADK 2.0 Workflow graph
root_agent = Workflow(
    name="supply_chain_workflow",
    edges=[
        ('START', analyzer),
        (analyzer, human_review)
    ],
    description="A workflow for supply chain risk analysis with human-in-the-loop review."
)

app = App(
    root_agent=root_agent,
    name="app",
)
