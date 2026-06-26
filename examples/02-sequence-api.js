//@::sequenceDiagram

//@Client
async function fetchUserData(userId) {
  //@Client1:Request user data
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
}

//@Server
app.get('/api/users/:id', async (req, res) => {
  //@Server1:Handle request
  const user = await db.findUser(req.params.id);
  res.json(user);
});

//@Database
async function findUser(id) {
  //@Database1:Query database
  return await db.query('SELECT * FROM users WHERE id = ?', [id]);
}

//@Error
function handleError(error) {
  //@Error1:Handle error
  console.error('API Error:', error);
  res.status(500).json({ error: 'Internal server error' });
}

// Conexões
//@Client->Server:HTTP Request
//@Server->Database:SQL Query
//@Database->Server:User data
//@Server->Client:JSON Response
//@Client->Error:Error occurs