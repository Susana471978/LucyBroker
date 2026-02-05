export async function getHealthStatus() {
  const response = await fetch('http://localhost:8000/health')
  const data = await response.json()

  return data
}
