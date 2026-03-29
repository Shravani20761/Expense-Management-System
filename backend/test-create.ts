// using native fetch
import * as crypto from 'crypto';

async function run() {
  const rand = crypto.randomUUID().split('-')[0];
  const email = `test${rand}@acme.com`;
  
  console.log('1. Signing up', email);
  const signupRes = await fetch('http://localhost:3000/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'password123',
      companyName: `Company ${rand}`,
      baseCurrency: 'USD'
    })
  });
  
  if (!signupRes.ok) {
    console.log('Signup failed:', await signupRes.text());
    return;
  }
  
  const signupData = await signupRes.json();
  const token = signupData.access_token;
  console.log('Token received:', token.substring(0, 20) + '...');
  
  console.log('2. Creating manager via POST /users');
  const createRes = await fetch('http://localhost:3000/users', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: `Manager ${rand}`,
      email: `manager${rand}@acme.com`,
      role: 'MANAGER'
    })
  });
  
  const createStatus = createRes.status;
  const createBody = await createRes.text();
  console.log(`Create Response: ${createStatus} ${createBody}`);
}

run().catch(console.error);
