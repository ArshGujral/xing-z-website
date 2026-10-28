// The admin panel's only backend is the website's own GitHub repository. Saving writes public/catalogue.json
// (and any uploaded photo) through the GitHub contents API; the Pages workflow then republishes the site.
// The token is the owner's own fine-grained token, kept in their browser and sent only to api.github.com.

export const REPO = { owner: 'ArshGujral', name: 'xing-z-website', branch: 'main' }
export const CATALOGUE_PATH = 'public/catalogue.json'
const TOKEN_KEY = 'xingz-admin-token'

export function savedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function rememberToken(token, persist) {
  try {
    ;(persist ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  } catch {
    // Storage blocked: the token lasts for this page only.
  }
}

export function forgetToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // nothing stored
  }
}

async function gh(token, path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const error = new Error(body.message || `GitHub returned ${res.status}`)
    error.status = res.status
    throw error
  }
  return res.status === 204 ? null : res.json()
}

const repoPath = (p) => `/repos/${REPO.owner}/${REPO.name}${p}`

const toBase64 = (bytes) => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
const fromBase64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)))

// Checks the token can write to the website's repository; returns the GitHub login.
export async function signIn(token) {
  const [user, repo] = await Promise.all([gh(token, '/user'), gh(token, repoPath(''))])
  if (!repo.permissions?.push) throw new Error('This token can read the repository but not write to it. Give it Contents: Read and write.')
  return user.login
}

export async function readCatalogue(token) {
  const file = await gh(token, repoPath(`/contents/${CATALOGUE_PATH}?ref=${REPO.branch}`))
  return { sha: file.sha, catalogue: JSON.parse(fromBase64(file.content)) }
}

export async function writeCatalogue(token, catalogue, sha, message) {
  const content = toBase64(new TextEncoder().encode(`${JSON.stringify(catalogue, null, 2)}\n`))
  const result = await gh(token, repoPath(`/contents/${CATALOGUE_PATH}`), {
    method: 'PUT',
    body: JSON.stringify({ message, content, sha, branch: REPO.branch }),
  })
  return result.content.sha
}

// Uploads a photo into public/products/uploads/ and returns its site path ("products/uploads/<name>").
export async function uploadPhoto(token, blob, name) {
  const path = `public/products/uploads/${name}`
  let sha
  try {
    sha = (await gh(token, repoPath(`/contents/${path}?ref=${REPO.branch}`))).sha
  } catch (e) {
    if (e.status !== 404) throw e
  }
  const content = toBase64(new Uint8Array(await blob.arrayBuffer()))
  await gh(token, repoPath(`/contents/${path}`), {
    method: 'PUT',
    body: JSON.stringify({ message: `Admin: upload ${name}`, content, sha, branch: REPO.branch }),
  })
  return `products/uploads/${name}`
}

// Shrinks a chosen photo to at most 1200px on its long side as WebP, keeping any transparency.
export async function preparePhoto(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86))
}

export const slug = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
