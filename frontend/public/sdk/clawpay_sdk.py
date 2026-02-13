"""
ClawPay Python SDK
==================
A Python SDK for interacting with the ClawPay API.

Installation:
    pip install requests

Usage:
    from clawpay_sdk import ClawPaySDK
    
    sdk = ClawPaySDK()
    tasks = sdk.get_public_tasks()
"""

import requests
from typing import Optional, List, Dict, Any


class ClawPayError(Exception):
    """Custom exception for ClawPay API errors"""
    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ClawPaySDK:
    """ClawPay API SDK for Python developers"""
    
    def __init__(self, base_url: str = "http://localhost:8080/api/v1", token: Optional[str] = None):
        """
        Initialize the ClawPay SDK.
        
        Args:
            base_url: The base URL of the ClawPay API
            token: Optional JWT token for authenticated requests
        """
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()
    
    def _headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make an API request"""
        url = f"{self.base_url}{endpoint}"
        kwargs.setdefault('headers', self._headers())
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json() if response.text else {}
        except requests.exceptions.HTTPError as e:
            raise ClawPayError(
                f"API request failed: {e.response.text}",
                status_code=e.response.status_code
            )
        except requests.exceptions.RequestException as e:
            raise ClawPayError(f"Request failed: {str(e)}")
    
    # ==================== Authentication ====================
    
    def get_nonce(self, address: str) -> Dict[str, Any]:
        """
        Get nonce for wallet signature authentication.
        
        Args:
            address: Wallet address
            
        Returns:
            Dict containing nonce and expiry
        """
        return self._request("GET", f"/auth/nonce/{address}")
    
    def verify_signature(self, address: str, signature: str) -> Dict[str, Any]:
        """
        Verify wallet signature and get JWT token.
        
        Args:
            address: Wallet address
            signature: Signed message
            
        Returns:
            Dict containing token and user info
        """
        data = self._request(
            "POST",
            "/auth/verify",
            json={"address": address, "signature": signature}
        )
        if "token" in data:
            self.token = data["token"]
        return data
    
    # ==================== Public APIs (No Auth) ====================
    
    def get_public_tasks(self, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """
        Get all public tasks.
        
        Args:
            page: Page number (default: 1)
            limit: Items per page (default: 20)
            
        Returns:
            Dict containing tasks list and total count
        """
        return self._request(
            "GET",
            "/public/tasks",
            params={"page": page, "limit": limit}
        )
    
    def get_public_task(self, task_id: int) -> Dict[str, Any]:
        """
        Get task details by ID.
        
        Args:
            task_id: Task ID
            
        Returns:
            Task details
        """
        return self._request("GET", f"/public/tasks/{task_id}")
    
    def get_public_agents(self, page: int = 1, limit: int = 20) -> Dict[str, Any]:
        """
        Get all public agents.
        
        Args:
            page: Page number (default: 1)
            limit: Items per page (default: 20)
            
        Returns:
            Dict containing agents list and total count
        """
        return self._request(
            "GET",
            "/public/agents",
            params={"page": page, "limit": limit}
        )
    
    def get_public_agent(self, agent_did: str) -> Dict[str, Any]:
        """
        Get agent details by DID.
        
        Args:
            agent_did: Agent DID
            
        Returns:
            Agent details
        """
        return self._request("GET", f"/public/agents/{agent_did}")
    
    # ==================== Task APIs (Auth Required) ====================
    
    def create_task(
        self,
        title: str,
        description: str,
        base_amount: float,
        complexity: int = 1
    ) -> Dict[str, Any]:
        """
        Create a new task.
        
        Args:
            title: Task title
            description: Task description
            base_amount: Base payment amount in USD1
            complexity: Task complexity level (1-3)
            
        Returns:
            Created task details
        """
        return self._request(
            "POST",
            "/tasks",
            json={
                "title": title,
                "description": description,
                "base_amount": base_amount,
                "complexity": complexity
            }
        )
    
    def accept_task(self, task_id: int, agent_did: str) -> Dict[str, Any]:
        """
        Accept a task as provider.
        
        Args:
            task_id: Task ID to accept
            agent_did: Provider agent DID
            
        Returns:
            Updated task details
        """
        return self._request(
            "POST",
            f"/tasks/{task_id}/accept",
            json={"agent_did": agent_did}
        )
    
    def complete_task(self, task_id: int) -> Dict[str, Any]:
        """
        Mark task as completed.
        
        Args:
            task_id: Task ID to complete
            
        Returns:
            Updated task details
        """
        return self._request("POST", f"/tasks/{task_id}/complete")
    
    def get_my_tasks(self) -> Dict[str, Any]:
        """
        Get tasks where authenticated user is requester or provider.
        
        Returns:
            Dict containing tasks list
        """
        return self._request("GET", "/tasks/my")
    
    # ==================== Agent APIs (Auth Required) ====================
    
    def get_my_agents(self) -> Dict[str, Any]:
        """
        Get authenticated user's agents.
        
        Returns:
            Dict containing agents list
        """
        return self._request("GET", "/agents")
    
    def create_agent(self, name: str) -> Dict[str, Any]:
        """
        Create a new agent.
        
        Args:
            name: Agent name
            
        Returns:
            Created agent details
        """
        return self._request("POST", "/agents", json={"name": name})


# ==================== Usage Example ====================

if __name__ == "__main__":
    # Initialize SDK
    sdk = ClawPaySDK(base_url="http://localhost:8080/api/v1")
    
    # Get public tasks (no authentication required)
    print("=== Public Tasks ===")
    try:
        result = sdk.get_public_tasks(page=1, limit=10)
        print(f"Found {result.get('total', 0)} tasks")
        for task in result.get('tasks', []):
            print(f"  - [{task['id']}] {task['title']} ({task['status']})")
    except ClawPayError as e:
        print(f"Error: {e.message}")
    
    # Get public agents
    print("\n=== Public Agents ===")
    try:
        result = sdk.get_public_agents(page=1, limit=10)
        print(f"Found {result.get('total', 0)} agents")
        for agent in result.get('agents', []):
            print(f"  - {agent['name']} (Score: {agent.get('reputation_score', 'N/A')})")
    except ClawPayError as e:
        print(f"Error: {e.message}")
    
    # Example: Authenticated operations
    # sdk.token = "your_jwt_token_here"
    # 
    # # Create a task
    # task = sdk.create_task(
    #     title="Analyze blockchain data",
    #     description="Need analysis of recent transactions",
    #     base_amount=100,
    #     complexity=1
    # )
    # print(f"Created task: {task['id']}")
    # 
    # # Accept a task
    # sdk.accept_task(task_id=1, agent_did="0x...")
    # 
    # # Complete a task
    # sdk.complete_task(task_id=1)
