import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, LogOut, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import PageHeader from '../components/PageHeader.jsx'
import { container } from '../components/SectionHeading.jsx'
import { asset } from '../content/site.js'
import { optionGroups, productsOf } from '../catalogue.js'
import { hasModel } from '../models/registry.js'
import {
  forgetToken,
  preparePhoto,
  readCatalogue,
  rememberToken,
  REPO,
  savedToken,
  signIn,
  slug,
  uploadPhoto,
  writeCatalogue,
} from '../admin/github.js'

const field =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-white text-sm placeholder:text-white/35 focus:outline-none focus:border-[#229784]/70'
const label = 'block text-white/70 text-xs font-medium mb-1.5'
const primary = 'px-5 py-2.5 rounded-full bg-white text-page text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50'
const quiet = 'px-4 py-2.5 rounded-full bg-white/[0.06] text-white text-sm font-medium hover:bg-white/[0.12] transition-colors'

const TOKEN_URL = `https://github.com/settings/personal-access-tokens/new`

function SignIn({ onSignedIn }) {
  const [token, setToken] = useState('')
  const [persist, setPersist] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const login = await signIn(token.trim())
      rememberToken(token.trim(), persist)
      onSignedIn(token.trim(), login)
    } catch (err) {
      setError(err.status === 401 ? 'GitHub did not accept this token.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-xl">
      <p className="text-accent text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">Admin</p>
      <h1 className="mt-4 text-white text-3xl sm:text-4xl leading-[1.05] tracking-[-0.02em]">Sign in to edit the catalogue.</h1>
      <p className="mt-4 text-white/70 text-sm sm:text-base leading-relaxed">
        Changes save straight to the website's GitHub repository and go live in about a minute. Sign in with a GitHub
        token that can write to <span className="text-white">{REPO.owner}/{REPO.name}</span>.
      </p>

      <form onSubmit={submit} className="mt-8 liquid-glass !bg-white/[0.03] rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
        <div>
          <label htmlFor="token" className={label}>
            GitHub token
          </label>
          <input
            id="token"
            type="password"
            autoComplete="off"
            spellCheck="false"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            className={field}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-white/75 text-sm">
          <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} className="accent-[#229784]" />
          Keep me signed in on this device
        </label>
        {error && <p className="text-[#ff8a8a] text-sm">{error}</p>}
        <button type="submit" disabled={busy || !token.trim()} className={primary}>
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>

      <details className="mt-6 text-white/70 text-sm leading-relaxed">
        <summary className="cursor-pointer text-white">How to get a token (once)</summary>
        <ol className="mt-3 list-decimal pl-5 space-y-1.5">
          <li>
            Open{' '}
            <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-4">
              GitHub → New fine-grained token
            </a>{' '}
            (signed in as {REPO.owner}).
          </li>
          <li>Name it "Xing-Z admin" and pick an expiry.</li>
          <li>
            Repository access: <span className="text-white">Only select repositories</span> → {REPO.name}.
          </li>
          <li>
            Permissions → Repository → <span className="text-white">Contents: Read and write</span>.
          </li>
          <li>Generate, copy the token, and paste it above. Keep it private, like a password.</li>
        </ol>
      </details>
    </div>
  )
}

function OptionRows({ rows, setRows, suggestions }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            value={row.key}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
            placeholder="Option (e.g. Size)"
            className={field}
            aria-label="Option name"
          />
          <input
            value={row.value}
            list={`values-${slug(row.key) || i}`}
            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
            placeholder="Value (e.g. 1&quot;)"
            className={field}
            aria-label="Option value"
          />
          <datalist id={`values-${slug(row.key) || i}`}>
            {(suggestions[row.key] ?? []).map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => setRows(rows.filter((_, j) => j !== i))}
            className="w-10 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06]"
            aria-label="Remove option"
          >
            <X className="w-4 h-4 mx-auto" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { key: '', value: '' }])} className={`${quiet} self-start`}>
        <Plus className="w-4 h-4 inline -mt-0.5 mr-1" /> Add option
      </button>
    </div>
  )
}

function PhotoInput({ current, file, setFile }) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : current ? asset(current) : null), [file, current])
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 flex-none rounded-2xl bg-white/[0.04] p-1.5">
        {preview ? <img src={preview} alt="" className="w-full h-full object-contain" /> : null}
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="text-white/70 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-white/[0.08] file:px-4 file:py-2 file:text-white file:text-sm"
      />
    </div>
  )
}

function ProductEditor({ catalogue, initial, onCancel, onSave, busy }) {
  const isNew = !initial
  const [family, setFamily] = useState(initial?.family ?? catalogue.families[0]?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [variants, setVariants] = useState((initial?.variants ?? []).join(', '))
  const [file, setFile] = useState(null)
  const familyOptions = (id) => catalogue.families.find((f) => f.id === id)?.options
  const groups = useMemo(() => optionGroups(productsOf(catalogue, family), familyOptions(family)), [catalogue, family])
  const suggestions = Object.fromEntries(groups.map((g) => [g.key, g.values]))
  const [rows, setRows] = useState(() =>
    initial
      ? Object.entries(initial.attributes ?? {}).map(([key, value]) => ({ key, value }))
      : groups.map((g) => ({ key: g.key, value: '' })),
  )
  const duplicate = catalogue.products.some((p) => p.code === code.trim() && p.code !== initial?.code)

  const changeFamily = (id) => {
    setFamily(id)
    if (isNew && rows.every((r) => !r.value)) {
      setRows(optionGroups(productsOf(catalogue, id), familyOptions(id)).map((g) => ({ key: g.key, value: '' })))
    }
  }

  const submit = (e) => {
    e.preventDefault()
    const attributes = Object.fromEntries(rows.filter((r) => r.key.trim() && r.value.trim()).map((r) => [r.key.trim(), r.value.trim()]))
    const list = variants.split(',').map((v) => v.trim()).filter(Boolean)
    const product = {
      code: code.trim(),
      family,
      name: name.trim(),
      description: description.trim() || name.trim(),
      attributes,
      ...(list.length ? { variants: list } : {}),
      ...(initial?.photo ? { photo: initial.photo } : {}),
    }
    onSave(product, file)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <h2 className="text-white text-2xl tracking-[-0.01em]">{isNew ? 'Add a product' : `Edit ${initial.code}`}</h2>
      <div>
        <label className={label} htmlFor="family">
          Range
        </label>
        <select id="family" value={family} onChange={(e) => changeFamily(e.target.value)} className={field}>
          {catalogue.families.map((f) => (
            <option key={f.id} value={f.id} className="bg-page">
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label} htmlFor="name">
            Product name (shown to visitors)
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder='High-Speed 1" · Maruti · 3-speed' required />
        </div>
        <div>
          <label className={label} htmlFor="code">
            Product code
          </label>
          <input id="code" value={code} onChange={(e) => setCode(e.target.value)} className={field} placeholder="1HS3SP(M)WR" required />
          {duplicate && <p className="mt-1 text-[#ff8a8a] text-xs">Another product already uses this code.</p>}
        </div>
      </div>
      <div>
        <label className={label} htmlFor="description">
          Full description (optional)
        </label>
        <input id="description" value={description} onChange={(e) => setDescription(e.target.value)} className={field} placeholder="As written in your price list" />
      </div>
      <div>
        <span className={label}>Options visitors choose between</span>
        <OptionRows rows={rows} setRows={setRows} suggestions={suggestions} />
      </div>
      <div>
        <label className={label} htmlFor="variants">
          Optional changes, separated by commas (leave empty to use the range's)
        </label>
        <input id="variants" value={variants} onChange={(e) => setVariants(e.target.value)} className={field} placeholder="Without ring, Without Tibcon capacitor" />
      </div>
      <div>
        <span className={label}>Photo (optional; the range's photo or 3D model is used otherwise)</span>
        <PhotoInput current={initial?.photo} file={file} setFile={setFile} />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={busy || duplicate || !name.trim() || !code.trim()} className={primary}>
          {busy ? 'Saving…' : isNew ? 'Add product' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className={quiet}>
          Cancel
        </button>
      </div>
    </form>
  )
}

const move = (list, i, by) => {
  const next = [...list]
  const j = i + by
  if (j < 0 || j >= next.length) return list
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

function OrderButtons({ list, i, onMove, what }) {
  const btn = 'w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] disabled:opacity-25 disabled:hover:bg-transparent'
  return (
    <span className="flex flex-none">
      <button type="button" disabled={i === 0} onClick={() => onMove(-1)} className={btn} aria-label={`Move ${what} up`}>
        <ChevronUp className="w-4 h-4 mx-auto" />
      </button>
      <button type="button" disabled={i === list.length - 1} onClick={() => onMove(1)} className={btn} aria-label={`Move ${what} down`}>
        <ChevronDown className="w-4 h-4 mx-auto" />
      </button>
    </span>
  )
}

// A range's options, edited for every product in it at once. Each entry remembers what it was (`from`), so a
// rename can be applied to the products that use the old name. New options start with one value for all products.
function OptionsEditor({ groups, setGroups, count }) {
  const set = (i, patch) => setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)))
  const remove = (i) => {
    const g = groups[i]
    if (g.from === null || window.confirm(`Remove "${g.from}" from all ${count} products in this range?`)) setGroups(groups.filter((_, j) => j !== i))
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, i) => (
        <div key={g.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <input value={g.key} onChange={(e) => set(i, { key: e.target.value })} className={`${field} font-medium`} aria-label="Option name" />
            <OrderButtons list={groups} i={i} onMove={(by) => setGroups(move(groups, i, by))} what="option" />
            <button type="button" onClick={() => remove(i)} className="w-8 h-8 flex-none rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06]" aria-label={`Remove ${g.key}`}>
              <Trash2 className="w-4 h-4 mx-auto" />
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-1.5 pl-3 border-l border-white/10">
            {g.values.map((v, k) => (
              <div key={v.from ?? k} className="flex items-center gap-2">
                <input
                  value={v.value}
                  onChange={(e) => set(i, { values: g.values.map((x, n) => (n === k ? { ...x, value: e.target.value } : x)) })}
                  className={field}
                  aria-label={`${g.key} value`}
                />
                {g.from !== null && (
                  <OrderButtons list={g.values} i={k} onMove={(by) => set(i, { values: move(g.values, k, by) })} what="value" />
                )}
              </div>
            ))}
          </div>
          {g.from === null && <p className="mt-2 text-white/45 text-xs">Every product in this range gets this value; change single products afterwards.</p>}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setGroups([...groups, { id: `new-${Date.now()}`, from: null, key: '', values: [{ from: null, value: '' }] }])}
        className={`${quiet} self-start`}
      >
        <Plus className="w-4 h-4 inline -mt-0.5 mr-1" /> Add option to the whole range
      </button>
    </div>
  )
}

function FamilyEditor({ catalogue, initial, onCancel, onSave, busy }) {
  const isNew = !initial
  const [name, setName] = useState(initial?.name ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [variants, setVariants] = useState((initial?.variants ?? []).join(', '))
  const [file, setFile] = useState(null)
  const id = initial?.id ?? slug(name)
  const taken = isNew && catalogue.families.some((f) => f.id === id)
  const products = isNew ? [] : productsOf(catalogue, initial.id)
  const [groups, setGroups] = useState(() =>
    optionGroups(products, initial?.options).map((g) => ({ id: g.key, from: g.key, key: g.key, values: g.values.map((v) => ({ from: v, value: v })) })),
  )
  const keys = groups.map((g) => g.key.trim())
  const badOptions =
    keys.some((k, i) => !k || keys.indexOf(k) !== i) ||
    groups.some((g) => g.values.some((v) => !v.value.trim()) || new Set(g.values.map((v) => v.value.trim())).size !== g.values.length)

  // Rewrite one product's options to match the edited list: renames, new options, removed ones and the order.
  const rewrite = (p) => {
    const attributes = {}
    for (const g of groups) {
      if (g.from === null) attributes[g.key.trim()] = g.values[0].value.trim()
      else if (p.attributes?.[g.from] !== undefined) {
        const was = p.attributes[g.from]
        attributes[g.key.trim()] = (g.values.find((v) => v.from === was)?.value ?? was).trim()
      }
    }
    return { ...p, attributes }
  }

  const submit = (e) => {
    e.preventDefault()
    onSave(
      {
        ...(initial ?? {}),
        id,
        name: name.trim(),
        summary: summary.trim(),
        photo: initial?.photo ?? '',
        model: initial?.model ?? id,
        variants: variants.split(',').map((v) => v.trim()).filter(Boolean),
        ...(groups.length ? { options: groups.map((g) => ({ key: g.key.trim(), values: g.values.map((v) => v.value.trim()) })) } : {}),
      },
      file,
      products.length ? rewrite : null,
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <h2 className="text-white text-2xl tracking-[-0.01em]">{isNew ? 'Add a range' : `Edit ${initial.name}`}</h2>
      <div>
        <label className={label} htmlFor="fname">
          Range name
        </label>
        <input id="fname" value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Blower Motors" required />
        {taken && <p className="mt-1 text-[#ff8a8a] text-xs">A range with this name already exists.</p>}
      </div>
      <div>
        <label className={label} htmlFor="summary">
          One-line description
        </label>
        <input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} className={field} placeholder="Drives blower wheels in centrifugal-blower coolers." />
      </div>
      <div>
        <label className={label} htmlFor="fvariants">
          Optional changes offered for the whole range, separated by commas
        </label>
        <input id="fvariants" value={variants} onChange={(e) => setVariants(e.target.value)} className={field} placeholder="Without ring" />
      </div>
      <div>
        <span className={label}>Options visitors choose between, in the order the configurator shows them</span>
        {products.length ? (
          <OptionsEditor groups={groups} setGroups={setGroups} count={products.length} />
        ) : (
          <p className="text-white/50 text-sm">Add a product to this range first; its options then show up here.</p>
        )}
        {badOptions && <p className="mt-2 text-[#ff8a8a] text-xs">Every option and value needs a name, with no repeats.</p>}
      </div>
      <div>
        <span className={label}>Range photo{isNew ? ' (shown until its 3D model is made)' : ''}</span>
        <PhotoInput current={initial?.photo} file={file} setFile={setFile} />
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={busy || taken || badOptions || !name.trim() || (isNew && !file)} className={primary}>
          {busy ? 'Saving…' : isNew ? 'Add range' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className={quiet}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function Dashboard({ token, login, onSignOut }) {
  const [state, setState] = useState(null) // { catalogue, sha }
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null) // { kind: 'product'|'family', item }
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')

  const load = async () => {
    setError('')
    try {
      setState(await readCatalogue(token))
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const commit = async (next, message) => {
    setBusy(true)
    setError('')
    try {
      const sha = await writeCatalogue(token, next, state.sha, message)
      setState({ catalogue: next, sha })
      setEditing(null)
      const done = message.replace(/^Admin: /, '')
      setNotice(`${done[0].toUpperCase()}${done.slice(1)}: saved. The website updates in about a minute.`)
    } catch (e) {
      if (e.status === 409 || e.status === 422) {
        setError('The catalogue was changed somewhere else in the meantime. It has been reloaded; please make your change again.')
        await load()
      } else {
        setError(e.message)
      }
    } finally {
      setBusy(false)
    }
  }

  const withPhoto = async (file, name) => (file ? uploadPhoto(token, await preparePhoto(file), `${slug(name)}-${Date.now()}.webp`) : null)

  const saveProduct = async (product, file) => {
    setBusy(true)
    try {
      const photo = await withPhoto(file, product.code)
      const item = photo ? { ...product, photo } : product
      const original = editing.item?.code
      const products = original
        ? state.catalogue.products.map((p) => (p.code === original ? item : p))
        : [...state.catalogue.products, item]
      await commit({ ...state.catalogue, products }, `Admin: ${original ? 'update' : 'add'} ${item.code}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const saveFamily = async (family, file, rewrite) => {
    setBusy(true)
    try {
      const photo = await withPhoto(file, family.id)
      const item = photo ? { ...family, photo } : family
      const exists = state.catalogue.families.some((f) => f.id === item.id)
      const families = exists ? state.catalogue.families.map((f) => (f.id === item.id ? item : f)) : [...state.catalogue.families, item]
      // Option renames and additions apply to every product in the range.
      const products = rewrite ? state.catalogue.products.map((p) => (p.family === item.id ? rewrite(p) : p)) : state.catalogue.products
      await commit({ ...state.catalogue, families, products }, `Admin: ${exists ? 'update' : 'add'} range ${item.name}`)
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const deleteProduct = (product) => {
    if (!window.confirm(`Delete ${product.name} (${product.code}) from the website?`)) return
    commit({ ...state.catalogue, products: state.catalogue.products.filter((p) => p.code !== product.code) }, `Admin: delete ${product.code}`)
  }

  if (error && !state) return <p className="text-[#ff8a8a]">{error}</p>
  if (!state) return <p className="text-white/50">Loading the catalogue from GitHub…</p>

  const { catalogue } = state
  const familyName = (id) => catalogue.families.find((f) => f.id === id)?.name ?? id
  const q = query.trim().toLowerCase()
  const shown = catalogue.products.filter(
    (p) => (filter === 'all' || p.family === filter) && (!q || `${p.name} ${p.code}`.toLowerCase().includes(q)),
  )

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-accent text-xs sm:text-sm font-medium uppercase tracking-[0.18em]">Admin</p>
          <h1 className="mt-3 text-white text-3xl sm:text-4xl leading-[1.05] tracking-[-0.02em]">Catalogue</h1>
          <p className="mt-2 text-white/60 text-sm">
            Signed in as <span className="text-white">{login}</span> · {catalogue.products.length} products in {catalogue.families.length} ranges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="configurator.html" target="_blank" rel="noopener noreferrer" className={quiet}>
            <ExternalLink className="w-4 h-4 inline -mt-0.5 mr-1" /> Configurator
          </a>
          <button type="button" onClick={onSignOut} className={quiet}>
            <LogOut className="w-4 h-4 inline -mt-0.5 mr-1" /> Sign out
          </button>
        </div>
      </div>

      {notice && (
        <p className="mt-6 rounded-2xl border border-[#229784]/40 bg-[#229784]/10 px-4 py-3 text-white text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-6 rounded-2xl border border-[#ff8a8a]/40 bg-[#ff8a8a]/10 px-4 py-3 text-white text-sm" role="alert">
          {error}
        </p>
      )}

      {editing ? (
        <div className="mt-8 max-w-3xl liquid-glass !bg-white/[0.03] rounded-3xl p-5 sm:p-7">
          {editing.kind === 'product' ? (
            <ProductEditor catalogue={catalogue} initial={editing.item} onCancel={() => setEditing(null)} onSave={saveProduct} busy={busy} />
          ) : (
            <FamilyEditor catalogue={catalogue} initial={editing.item} onCancel={() => setEditing(null)} onSave={saveFamily} busy={busy} />
          )}
        </div>
      ) : (
        <>
          <section className="mt-10" aria-labelledby="ranges">
            <div className="flex items-center justify-between gap-4">
              <h2 id="ranges" className="text-white text-xl tracking-[-0.01em]">
                Ranges
              </h2>
              <button type="button" onClick={() => setEditing({ kind: 'family', item: null })} className={quiet}>
                <Plus className="w-4 h-4 inline -mt-0.5 mr-1" /> Add range
              </button>
            </div>
            <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {catalogue.families.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'family', item: f })}
                    className="w-full flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-2 pr-3 text-left hover:border-white/25 transition-colors"
                  >
                    <span className="w-11 h-11 flex-none rounded-xl bg-white/[0.04] p-1">
                      {f.photo && <img src={asset(f.photo)} alt="" className="w-full h-full object-contain" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-white text-sm font-medium truncate">{f.name}</span>
                      <span className="block text-white/50 text-xs">
                        {productsOf(catalogue, f.id).length} products · {hasModel(f.model) ? '3D model' : 'photo only'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10" aria-labelledby="products">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 id="products" className="text-white text-xl tracking-[-0.01em]">
                Products
              </h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or code" className={`${field} pl-9 sm:w-60`} />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${field} sm:w-48`} aria-label="Filter by range">
                  <option value="all" className="bg-page">
                    All ranges
                  </option>
                  {catalogue.families.map((f) => (
                    <option key={f.id} value={f.id} className="bg-page">
                      {f.name}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setEditing({ kind: 'product', item: null })} className={primary}>
                  <Plus className="w-4 h-4 inline -mt-0.5 mr-1" /> Add product
                </button>
              </div>
            </div>

            <ul className="mt-4 flex flex-col gap-2">
              {shown.map((p) => (
                <li key={p.code} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{p.name}</p>
                    <p className="text-white/50 text-xs truncate">
                      {p.code} · {familyName(p.family)}
                    </p>
                  </div>
                  <a
                    href={`configurator.html?code=${encodeURIComponent(p.code)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06]"
                    aria-label={`View ${p.code} in the configurator`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => setEditing({ kind: 'product', item: p })}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/[0.06]"
                    aria-label={`Edit ${p.code}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProduct(p)}
                    disabled={busy}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-[#ff8a8a] hover:bg-white/[0.06]"
                    aria-label={`Delete ${p.code}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
              {!shown.length && <li className="text-white/50 text-sm px-1">No products match.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

// The catalogue admin: sign in with a GitHub token, then add, edit or remove products and ranges.
export default function Admin() {
  const [session, setSession] = useState(null) // { token, login }
  const [checking, setChecking] = useState(() => Boolean(savedToken()))

  // Resume a saved sign-in, if it still works.
  useEffect(() => {
    const token = savedToken()
    if (!token) return
    signIn(token)
      .then((login) => setSession({ token, login }))
      .catch(() => forgetToken())
      .finally(() => setChecking(false))
  }, [])

  const signOut = () => {
    forgetToken()
    setSession(null)
  }

  return (
    <>
      <PageHeader links={[{ label: 'Configurator', href: 'configurator.html' }]} action={false} />
      <main className="pt-[calc(6.5rem+env(safe-area-inset-top))] sm:pt-[calc(7.5rem+env(safe-area-inset-top))] pb-24">
        <div className={container}>
          {checking ? (
            <p className="text-white/50">Signing you in…</p>
          ) : session ? (
            <Dashboard token={session.token} login={session.login} onSignOut={signOut} />
          ) : (
            <SignIn onSignedIn={(token, login) => setSession({ token, login })} />
          )}
        </div>
      </main>
    </>
  )
}
