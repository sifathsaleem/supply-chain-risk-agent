from unittest.mock import AsyncMock, patch

import pytest
from google.adk.agents.context import Context

from risk_agent.agent import risk_score_node


@pytest.fixture
def mock_context():
    return AsyncMock(spec=Context)

@pytest.mark.asyncio
@patch("risk_agent.agent.mcp.call_tool", new_callable=AsyncMock)
async def test_scoring_negative_sentiment_flood(mock_call_tool, mock_context):
    """Case 1: NEGATIVE sentiment + flood event -> score 60, risk_level MEDIUM"""
    node_input = {
        "supplier_name": "Test Supplier",
        "country": "Japan",
        "category": "Electronics",
        "sentiment": "NEGATIVE",
        "confidence": 0.95,
        "entities": {
            "locations": ["Japan"],
            "event_types": ["flood"],
            "industries": ["Electronics"]
        }
    }

    # Call the underlying wrapped function directly using ._func
    result = await risk_score_node._func(mock_context, node_input)

    assert result["risk_score"] == 60
    assert result["risk_level"] == "MEDIUM"
    assert result["recommended_action"] == "Monitor closely and prepare contingency plan with backup supplier."

    # Verify BQ write was called through the MCP tool
    mock_call_tool.assert_called_once()
    args, _kwargs = mock_call_tool.call_args
    assert args[0] == "bigquery_write"
    assert args[1]["table_name"] == "supplier_risk_scores"
    assert args[1]["row"]["risk_score"] == 60

@pytest.mark.asyncio
@patch("risk_agent.agent.mcp.call_tool", new_callable=AsyncMock)
async def test_scoring_negative_sentiment_flood_bankruptcy(mock_call_tool, mock_context):
    """Case 2: NEGATIVE sentiment + flood + bankruptcy -> score 80, risk_level HIGH"""
    node_input = {
        "supplier_name": "Test Supplier",
        "country": "Japan",
        "category": "Electronics",
        "sentiment": "NEGATIVE",
        "confidence": 0.95,
        "entities": {
            "locations": ["Japan"],
            "event_types": ["flood", "bankruptcy"],
            "industries": ["Electronics"]
        }
    }

    result = await risk_score_node._func(mock_context, node_input)

    assert result["risk_score"] == 80
    assert result["risk_level"] == "HIGH"
    assert result["recommended_action"] == "Immediately activate backup supplier and increase safety stock by 30 days."

@pytest.mark.asyncio
@patch("risk_agent.agent.mcp.call_tool", new_callable=AsyncMock)
async def test_scoring_neutral_sentiment_strike(mock_call_tool, mock_context):
    """Case 3: NEUTRAL sentiment + strike -> score 20, risk_level LOW"""
    node_input = {
        "supplier_name": "Test Supplier",
        "country": "Japan",
        "category": "Electronics",
        "sentiment": "NEUTRAL",
        "confidence": 0.95,
        "entities": {
            "locations": ["Japan"],
            "event_types": ["strike"],
            "industries": ["Electronics"]
        }
    }

    result = await risk_score_node._func(mock_context, node_input)

    assert result["risk_score"] == 20
    assert result["risk_level"] == "LOW"
    assert result["recommended_action"] == "Continue standard monitoring. No immediate action required."

@pytest.mark.asyncio
@patch("risk_agent.agent.mcp.call_tool", new_callable=AsyncMock)
async def test_scoring_positive_sentiment_no_events(mock_call_tool, mock_context):
    """Case 4: POSITIVE sentiment + no events -> score 0, risk_level LOW"""
    node_input = {
        "supplier_name": "Test Supplier",
        "country": "Japan",
        "category": "Electronics",
        "sentiment": "POSITIVE",
        "confidence": 0.95,
        "entities": {
            "locations": ["Japan"],
            "event_types": [],
            "industries": ["Electronics"]
        }
    }

    result = await risk_score_node._func(mock_context, node_input)

    assert result["risk_score"] == 0
    assert result["risk_level"] == "LOW"
    assert result["recommended_action"] == "Continue standard monitoring. No immediate action required."
