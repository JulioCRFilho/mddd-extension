//@::stateDiagram-v2

//@LoggedOut
function showLoginPage() {
  //@LoggedOut1:Display login form
  displayForm();
}

//@LoggedIn
function showDashboard() {
  //@LoggedIn1:Load user data
  loadUserData();
  //@LoggedIn1.1:Render dashboard
  renderDashboard();
}

//@SessionExpired
function handleSessionExpired() {
  //@SessionExpired1:Clear session
  clearSession();
  //@SessionExpired1.1:Redirect to login
  redirectToLogin();
}

// Transições (cada uma com código abaixo)
//@LoggedOut->LoggedIn:Login success
function loginSuccess() {
  console.log('Login successful');
}

//@LoggedIn->SessionExpired:Token expired
function tokenExpired() {
  console.log('Token expired');
}

//@SessionExpired->LoggedOut:Clear state
function clearState() {
  console.log('State cleared');
}