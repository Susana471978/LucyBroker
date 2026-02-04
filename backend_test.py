import requests
import sys
import json
from datetime import datetime

class EmailControlSystemTester:
    def __init__(self, base_url="https://inboxcontrol.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name} - PASSED")
        else:
            print(f"❌ {name} - FAILED: {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            
            if success:
                self.log_test(name, True)
                try:
                    return response.json() if response.content else {}
                except:
                    return {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                
                self.log_test(name, False, error_msg)
                return {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return {}

    def test_health_endpoints(self):
        """Test basic health endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        # Test root endpoint
        self.run_test("Root Endpoint", "GET", "", 200)
        
        # Test health endpoint
        self.run_test("Health Check", "GET", "health", 200)

    def test_auth_flow(self):
        """Test complete authentication flow"""
        print("\n" + "="*50)
        print("TESTING AUTHENTICATION FLOW")
        print("="*50)
        
        # Generate unique test user
        timestamp = datetime.now().strftime('%H%M%S')
        test_email = f"test_user_{timestamp}@example.com"
        test_password = "TestPass123!"
        test_name = f"Test User {timestamp}"

        # Test user registration
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name
        }
        
        response = self.run_test("User Registration", "POST", "auth/register", 200, register_data)
        
        if response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   ✓ Token received: {self.token[:20]}...")
            print(f"   ✓ User ID: {self.user_id}")
        else:
            print("   ❌ Registration failed - no token received")
            return False

        # Test get current user
        self.run_test("Get Current User", "GET", "auth/me", 200)

        # Test login with same credentials
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        login_response = self.run_test("User Login", "POST", "auth/login", 200, login_data)
        
        if login_response and 'token' in login_response:
            self.token = login_response['token']
            print(f"   ✓ Login token: {self.token[:20]}...")

        # Test language update
        self.run_test("Update Language to EN", "PUT", "auth/language?language=en", 200)
        self.run_test("Update Language to ES", "PUT", "auth/language?language=es", 200)

        return True

    def test_email_endpoints(self):
        """Test email-related endpoints"""
        print("\n" + "="*50)
        print("TESTING EMAIL ENDPOINTS")
        print("="*50)
        
        if not self.token:
            print("❌ No authentication token - skipping email tests")
            return False

        # Test get all emails
        emails_response = self.run_test("Get All Emails", "GET", "emails", 200)
        
        if not emails_response:
            print("❌ Failed to get emails")
            return False

        emails = emails_response if isinstance(emails_response, list) else []
        print(f"   ✓ Retrieved {len(emails)} emails")

        # Test email filtering
        self.run_test("Filter Priority Emails", "GET", "emails?label=PRIORITARIO", 200)
        self.run_test("Filter Follow-up Emails", "GET", "emails?label=SEGUIMIENTO", 200)
        self.run_test("Filter Info Emails", "GET", "emails?label=INFO", 200)
        self.run_test("Filter Emails with Attachments", "GET", "emails?has_attachments=true", 200)

        # Test email stats
        stats_response = self.run_test("Get Email Stats", "GET", "emails/stats/summary", 200)
        
        if stats_response:
            print(f"   ✓ Stats: Total={stats_response.get('total', 0)}, Priority={stats_response.get('prioritarios', 0)}")

        # Test individual email retrieval
        if emails and len(emails) > 0:
            first_email_id = emails[0]['email']['id']
            self.run_test("Get Individual Email", "GET", f"emails/{first_email_id}", 200)
            return first_email_id
        
        return None

    def test_ai_endpoints(self, email_id=None):
        """Test AI-related endpoints"""
        print("\n" + "="*50)
        print("TESTING AI ENDPOINTS")
        print("="*50)
        
        if not self.token:
            print("❌ No authentication token - skipping AI tests")
            return False

        # Test AI chat with different intents
        chat_tests = [
            {"message": "mostrar prioritarios", "intent": "priority"},
            {"message": "correos con adjuntos", "intent": "attachments"},
            {"message": "resumir correos", "intent": "summarize"},
            {"message": "ayuda con respuesta", "intent": "draft"},
            {"message": "clima hoy", "intent": "out_of_scope"},  # Should be rejected
        ]

        for chat_test in chat_tests:
            chat_data = {"message": chat_test["message"]}
            response = self.run_test(f"AI Chat - {chat_test['intent']}", "POST", "ai/chat", 200, chat_data)
            
            if response and 'assistant_text' in response:
                print(f"   ✓ AI Response: {response['assistant_text'][:100]}...")

        # Test AI summarize (if we have an email ID)
        if email_id:
            summarize_data = {"email_id": email_id}
            summary_response = self.run_test("AI Email Summarize", "POST", "ai/summarize", 200, summarize_data)
            
            if summary_response and 'summary' in summary_response:
                print(f"   ✓ Summary: {summary_response['summary'][:100]}...")

            # Test AI draft reply
            draft_data = {
                "email_id": email_id,
                "instructions": "Acepta la propuesta y agenda una reunión",
                "tone": "professional"
            }
            draft_response = self.run_test("AI Draft Reply", "POST", "ai/draft-reply", 200, draft_data)
            
            if draft_response and 'drafts' in draft_response:
                print(f"   ✓ Generated {len(draft_response['drafts'])} draft options")

    def test_error_cases(self):
        """Test error handling"""
        print("\n" + "="*50)
        print("TESTING ERROR CASES")
        print("="*50)

        # Test invalid endpoints
        self.run_test("Invalid Endpoint", "GET", "invalid/endpoint", 404)
        
        # Test unauthorized access (without token)
        old_token = self.token
        self.token = None
        self.run_test("Unauthorized Email Access", "GET", "emails", 401)
        self.token = old_token

        # Test invalid email ID
        self.run_test("Invalid Email ID", "GET", "emails/invalid-id", 404)

        # Test invalid AI requests
        self.run_test("AI Summarize Invalid Email", "POST", "ai/summarize", 404, {"email_id": "invalid-id"})

    def run_all_tests(self):
        """Run complete test suite"""
        print("🚀 Starting Email Control System API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("="*70)

        # Run test suites
        self.test_health_endpoints()
        
        auth_success = self.test_auth_flow()
        if auth_success:
            email_id = self.test_email_endpoints()
            self.test_ai_endpoints(email_id)
        
        self.test_error_cases()

        # Print final results
        print("\n" + "="*70)
        print("📊 FINAL TEST RESULTS")
        print("="*70)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")

        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")

        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = EmailControlSystemTester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/test_reports/backend_test_results.json', 'w') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_tests': tester.tests_run,
            'passed_tests': tester.tests_passed,
            'success_rate': (tester.tests_passed/tester.tests_run)*100 if tester.tests_run > 0 else 0,
            'results': tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())