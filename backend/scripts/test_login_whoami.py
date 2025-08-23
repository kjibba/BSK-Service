import requests
s = requests.Session()
print('Logging in...')
r = s.post('http://127.0.0.1:5000/api/auth/login', json={'email':'kjibba@gmail.com'})
print('login status', r.status_code, r.text)
r2 = s.get('http://127.0.0.1:5000/api/auth/whoami')
print('whoami', r2.status_code, r2.text)
