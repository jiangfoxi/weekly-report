import fs from 'fs'
import os from 'os'
import path from 'path'

type GithubConfig = {
  token: string
  baseUrl: string
}

export function getGithubConfig(): GithubConfig {
  const configPath = path.join(os.homedir(), '.github', 'config.json')

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `GitHub config not found at ${configPath}. ` +
      'Create it with: { "token": "ghp_xxx", "githubBaseUrl": "https://api.github.com" }'
    )
  }

  const raw = fs.readFileSync(configPath, 'utf-8')
  const json = JSON.parse(raw) as { token: string; githubBaseUrl?: string }

  if (!json.token) {
    throw new Error(`GitHub config at ${configPath} is missing "token" field`)
  }

  return {
    token: json.token,
    baseUrl: json.githubBaseUrl ?? 'https://api.github.com',
  }
}
