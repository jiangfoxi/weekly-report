import { Octokit } from '@octokit/rest'
import { getGithubConfig } from '../config'

export type GithubCommit = {
  repo: string
  sha: string
  message: string
  url: string
  date: string
}

export async function fetchWeekCommits(start: Date, end: Date): Promise<GithubCommit[]> {
  const config = getGithubConfig()
  const octokit = new Octokit({
    auth: config.token,
    baseUrl: config.baseUrl,
  })

  const userResp = await octokit.rest.users.getAuthenticated()
  const username = userResp.data.login

  const reposResp = await octokit.rest.repos.listForAuthenticatedUser({
    affiliation: 'owner,collaborator',
    sort: 'pushed',
    per_page: 100,
  })

  // Only repos pushed after start date (minus 1 day buffer)
  const cutoff = new Date(start)
  cutoff.setDate(cutoff.getDate() - 1)
  const activeRepos = reposResp.data.filter((repo) => {
    const pushedAt = repo.pushed_at ? new Date(repo.pushed_at) : null
    return pushedAt && pushedAt >= cutoff
  })

  const sinceStr = start.toISOString()
  const untilStr = end.toISOString()

  const allCommits: GithubCommit[] = []
  const seenShas = new Set<string>()

  await Promise.all(
    activeRepos.map(async (repo) => {
      try {
        const isOwnRepo = repo.owner.login === username

        const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
          owner: repo.owner.login,
          repo: repo.name,
          // For own repos: include all commits (git author may not be linked to GitHub account)
          // For collaborator repos: filter by login
          ...(isOwnRepo ? {} : { author: username }),
          since: sinceStr,
          until: untilStr,
          per_page: 100,
        })

        for (const c of commits) {
          if (seenShas.has(c.sha)) continue
          seenShas.add(c.sha)
          allCommits.push({
            repo: repo.full_name,
            sha: c.sha.slice(0, 7),
            message: c.commit.message.split('\n')[0],
            url: c.html_url,
            date: c.commit.committer?.date ?? c.commit.author?.date ?? '',
          })
        }
      } catch {
        // skip repos we can't access
      }
    })
  )

  return allCommits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
