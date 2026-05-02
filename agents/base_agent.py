"""
Production Agent Framework: LangChain + Groq (100% FREE)
- Memory management (short + long-term)
- Tool routing
- Error recovery
- Multi-turn conversations
"""

from langchain_groq import ChatGroq
from langchain.memory import ConversationBufferMemory, ConversationSummaryMemory
from langchain.tools import Tool, tool
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import JsonOutputParser
import json
from datetime import datetime
import asyncio
from typing import Dict, List, Any, Optional


# Initialize FREE Groq (Llama 3.1 70B)
# API key MUST come from environment variable (GROQ_API_KEY)
import os
DEFAULT_LLM = ChatGroq(
    model="llama-3.1-70b-versatile",
    temperature=0.1,
    max_tokens=2048,
    groq_api_key=os.environ.get("GROQ_API_KEY", "")
)


# Memory layers
short_term_memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True,
    max_token_limit=4096  # Context window management
)

long_term_memory = ConversationSummaryMemory(
    llm=DEFAULT_LLM,
    memory_key="summary",
    buffer="This agent monitors aircraft entities and detects anomalies"
)


class SentinelAgent:
    """
    Base agent for Sentinel-X domain tasks.
    
    Features:
    - Configurable memory management (short + long-term)
    - Tool routing for domain-specific tasks
    - Error recovery with timeout handling
    - Multi-turn conversation support
    
    Args:
        agent_name: Human-readable name for the agent
        task_description: Description of the agent's purpose
        llm: Optional LLM instance (defaults to Groq Llama 3.1)
    """
    
    def __init__(self, agent_name: str, task_description: str, llm: Optional[ChatGroq] = None):
        self.agent_name = agent_name
        self.task_description = task_description
        self.llm = llm or DEFAULT_LLM
        self.execution_log: List[Dict[str, Any]] = []
        self.error_count: int = 0
        self.success_count: int = 0
        
    async def setup_tools(self) -> List[Tool]:
        """
        Define domain-specific tools for the agent.
        
        Override this method in subclasses to provide specific tools.
        
        Returns:
            List of LangChain Tool objects
        """
        
        @tool
        def query_entity_database(entity_id: str) -> Dict:
            """
            Fetch entity data from Neon PGVector
            Args:
                entity_id: Aircraft or vessel identifier
            Returns:
                Entity metadata + embedding
            """
            # SECURITY: Validate entity_id to prevent SSRF
            import re
            # Block RFC-1918 private ranges and special chars
            if not entity_id or len(entity_id) > 64:
                return {"error": "Invalid entity_id"}
            if re.search(r"[\n\r\t\x00-\x1f]|^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|localhost)", entity_id, re.I):
                return {"error": "Invalid entity_id"}
            # Mock - replace with real DB query
            return {
                "entity_id": entity_id,
                "domain": "aircraft",
                "last_position": {"lat": 40.5, "lon": -74.0},
                "velocity": 450,
                "altitude": 35000,
                "confidence": 0.98
            }
        
        @tool
        def vector_similarity_search(query_embedding: List[float], top_k: int = 5) -> List[Dict]:
            """
            Find similar entities using vector search
            Args:
                query_embedding: 384-dim MiniLM embedding
                top_k: Number of results
            Returns:
                List of similar entities with distances
            """
            return [
                {"entity_id": f"entity_{i}", "distance": 0.1 * i}
                for i in range(top_k)
            ]
        
        @tool
        def classify_anomaly(entity_data: Dict) -> Dict:
            """
            Use Groq to classify if entity is anomalous
            Args:
                entity_data: Entity metadata
            Returns:
                Classification + confidence + reason
            """
            # SECURITY: Sanitize entity_data before LLM prompt
            import re
            import json
            
            # Remove prompt injection patterns
            sanitized = re.sub(
                r"(ignore previous|disregard your|<script|{{|}}|javascript:|onerror=|onclick=)",
                "[REDACTED]",
                json.dumps(entity_data),
                flags=re.IGNORECASE
            )
            
            prompt = f"""Analyze this entity for anomalies:
            
Data: {sanitized}

Classify as:
- NORMAL: Regular behavior
- ANOMALY: Suspicious pattern
- ALERT: High risk

Return JSON: {{"class": "...", "confidence": 0.0-1.0, "reason": "..."}}"""
            
            response = self.llm.invoke(prompt)
            return json.loads(response.content)
        
        @tool
        def generate_alert(entity_id: str, anomaly_type: str, severity: str) -> Dict:
            """
            Create actionable alert for SOC team
            Args:
                entity_id: Detected entity
                anomaly_type: Type of anomaly
                severity: HIGH|MEDIUM|LOW
            Returns:
                Alert with mitigation steps
            """
            return {
                "alert_id": f"ALR_{datetime.now().timestamp():.0f}",
                "entity_id": entity_id,
                "type": anomaly_type,
                "severity": severity,
                "timestamp": datetime.now().isoformat(),
                "mitigation": f"Review {entity_id} trajectory for {anomaly_type}"
            }
        
        return [
            query_entity_database,
            vector_similarity_search,
            classify_anomaly,
            generate_alert
        ]
    
    async def execute(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Execute agent with error recovery and timeout handling.
        
        Args:
            user_input: The input prompt for the agent
            context: Optional context dictionary
            
        Returns:
            Dictionary with execution status and results
        """
        try:
            # Setup tools
            tools = await self.setup_tools()
            
            # Create agent prompt
            system_prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are {self.agent_name}, an AI system for {self.task_description}.
                
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
- Handle ambiguous cases by requesting clarification"""),
                ("human", "{input}"),
                MessagesPlaceholder(variable_name="agent_scratchpad")
            ])
            
            # Create agent
            agent = create_tool_calling_agent(self.llm, tools, system_prompt)
            executor = AgentExecutor(
                agent=agent,
                tools=tools,
                verbose=True,
                max_iterations=10,
                handle_parsing_errors=True,
                early_stopping_method="generate"
            )
            
            # Execute with timeout
            result = await asyncio.wait_for(
                asyncio.to_thread(executor.invoke, {"input": user_input}),
                timeout=30.0
            )
            
            # Log success
            self.success_count += 1
            self.execution_log.append({
                "timestamp": datetime.now().isoformat(),
                "input": user_input,
                "output": result["output"],
                "status": "success"
            })
            
            return {
                "status": "success",
                "result": result["output"],
                "agent": self.agent_name
            }
            
        except asyncio.TimeoutError:
            self.error_count += 1
            return {
                "status": "timeout",
                "error": f"Agent exceeded 30s execution time",
                "agent": self.agent_name
            }
        except Exception as e:
            self.error_count += 1
            self.execution_log.append({
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
