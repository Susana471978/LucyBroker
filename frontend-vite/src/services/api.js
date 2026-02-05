export async function getHealth() {
  const response = await fetch('http://localhost:8000/health')

  return response.ok
}
