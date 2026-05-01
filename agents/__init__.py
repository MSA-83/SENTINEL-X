"""
SENTINEL-X AI Agent Framework
Production Agent Framework: LangChain + Groq (100% FREE)
- Memory management (short + long-term)
- Tool routing
- Error recovery
- Multi-turn conversations
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Any, Callable, Optional
from dataclasses import dataclass, field
from langchain_groq import ChatGroq
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.tools import Tool
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import JsonOutputParser


GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")


@dataclass
class AgentMetrics:
    """Track agent execution metrics"""
    success_count: int = 0
    error_count: int = 0
    total_requests: int = 0
    avg_latency_ms: float = 0.0
    execution_log: list = field(default_factory=list)


class SentinelAgent:
    """Base agent for Sentinel-X domain tasks"""
    
    def __init__(self, agent_name: str, task_description: str):
        self.agent_name = agent_name
        self.task_description = task_description
        self.metrics = AgentMetrics()
        self.llm = ChatGroq(
            model="llama-3.1-70b-versatile",
            temperature=0.1,
            max_tokens=2048,
            groq_api_key=GROQ_API_KEY,
            timeout=30
        )
        self.short_term_memory = ConversationBufferMemory(
            memory_key="chat_history",
            return_messages=True,
            max_token_limit=4096
        )
        self.long_term_memory = ConversationSummaryMemory(
            llm=self.llm,
            memory_key="summary",
            buffer="This agent monitors aircraft entities and detects anomalies"
        )
    
    async def setup_tools(self) -> list[Tool]:
        """Define domain-specific tools - override in subclasses"""
        raise NotImplementedError("Subclasses must implement setup_tools")
    
    def get_system_prompt(self) -> str:
        return f"""You are {self.agent_name}, an AI system for {self.task_description}.

Your responsibilities:
1. Query entity databases for relevant information
2. Perform vector similarity searches for related entities
3. Classify entities as normal or anomalous
4. Generate actionable alerts for security teams
5. Explain your reasoning at each step

Always:
- Use tools systematically
- Validate data before classification
- Provide confidence scores
- Suggest next actions
- Handle ambiguous cases by requesting clarification"""

    async def execute(self, user_input: str, context: dict = None) -> dict:
        """Execute agent with error recovery"""
        start_time = datetime.now()
        
        try:
            tools = await self.setup_tools()
            
            system_prompt = ChatPromptTemplate.from_messages([
                ("system", self.get_system_prompt()),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad")
            ])
            
            agent = create_tool_calling_agent(self.llm, tools, system_prompt)
            executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=False,
                max_iterations=10,
                handle_parsing_errors=True,
                early_stopping_method="generate"
            )
            
            result = await asyncio.wait_for(
                asyncio.to_thread(executor.invoke, {"input": user_input}),
                timeout=30.0
            )
            
            self.metrics.success_count += 1
            latency = (datetime.now() - start_time).total_seconds() * 1000
            self.metrics.avg_latency_ms = (self.metrics.avg_latency_ms * self.metrics.total_requests + latency) / (self.metrics.total_requests + 1)
            self.metrics.total_requests += 1
            
            self.metrics.execution_log.append({
                "timestamp": datetime.now().isoformat(),
                "input": user_input,
                "output": result.get("output", ""),
                "status": "success",
                "latency_ms": latency
            })
            
            return {
                "status": "success",
                "result": result.get("output", ""),
                "agent": self.agent_name,
                "latency_ms": latency
            }
            
        except asyncio.TimeoutError:
            self.metrics.error_count += 1
            return {
                "status": "timeout",
                "error": f"Agent exceeded 30s execution time",
                "agent": self.agent_name
            }
        except Exception as e:
            self.metrics.error_count += 1
            self.metrics.execution_log.append({
                "timestamp": datetime.now().isoformat(),
                "input": user_input,
                "error": str(e),
                "status": "failed"
            })
            return {
                "status": "error",
                "error": str(e),
                "agent": self.agent_name
            }
    
    def get_metrics(self) -> dict:
        return {
            "agent_name": self.agent_name,
            "success_count": self.metrics.success_count,
            "error_count": self.metrics.error_count,
            "total_requests": self.metrics.total_requests,
            "avg_latency_ms": self.metrics.avg_latency_ms,
            "success_rate": self.metrics.success_count / max(1, self.metrics.total_requests)
        }


def create_agent(agent_type: str, agent_name: str) -> SentinelAgent:
    """Factory function to create agents"""
    from .classifier_agent import EntityClassifierAgent
    from .anomaly_detector_agent import AnomalyDetectorAgent
    from .dataset_curator_agent import DatasetCuratorAgent
    
    agents = {
        "classifier": EntityClassifierAgent,
        "anomaly": AnomalyDetectorAgent,
        "curator": DatasetCuratorAgent
    }
    
    if agent_type not in agents:
        raise ValueError(f"Unknown agent type: {agent_type}")
    
    return agents[agent_type](agent_name)