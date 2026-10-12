<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const emit = defineEmits(['saved'])
const PAGE = 12
const items = ref([])
const total = ref(0)
const offset = ref(0)
const search = ref('')
const loading = ref(false)
const error = ref('')
const savingId = ref(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.feed({ limit: PAGE, offset: offset.value, search: search.value })
    items.value = res.results
    total.value = res.count
  } catch (e) {
    error.value = e.message
    items.value = []
  } finally {
    loading.value = false
  }
}
function doSearch() { offset.value = 0; load() }
function page(d) { offset.value = Math.max(0, offset.value + d * PAGE); load(); window.scrollTo(0, 0) }

async function save(a) {
  savingId.value = a.externalId
  try {
    await api.createArticle(a)
    a.saved = true
    emit('saved', 'Saved to My Articles')
  } catch (e) {
    error.value = e.message
  } finally {
    savingId.value = null
  }
}
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '')
onMounted(load)
</script>

<template>
  <div class="container">
    <div class="page-head"><h2>Live feed</h2></div>
    <form class="toolbar" @submit.prevent="doSearch">
      <input v-model="search" placeholder="Search headlines (e.g. Mars, SpaceX)…" />
      <button class="primary">Search</button>
    </form>
    <div v-if="error" class="error">{{ error }} <button class="link" @click="load">Retry</button></div>
    <div v-if="loading" class="loading">Loading news…</div>
    <div v-else-if="!items.length && !error" class="empty">No articles found.</div>
    <div v-else class="grid">
      <article v-for="a in items" :key="a.externalId" class="card article">
        <img v-if="a.imageUrl" :src="a.imageUrl" :alt="a.title" loading="lazy" />
        <div class="body">
          <div class="meta">{{ a.source }} · {{ fmt(a.publishedAt) }}</div>
          <h3>{{ a.title }}</h3>
          <p>{{ a.summary }}</p>
          <div class="row">
            <a :href="a.url" target="_blank" rel="noopener noreferrer">Read</a>
            <span v-if="a.saved" class="badge">✓ Saved</span>
            <button v-else :disabled="savingId === a.externalId" @click="save(a)">
              {{ savingId === a.externalId ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </article>
    </div>
    <div v-if="!loading && items.length" class="pager">
      <button :disabled="offset === 0" @click="page(-1)">← Previous</button>
      <span>{{ offset + 1 }}–{{ Math.min(offset + PAGE, total) }} of {{ total }}</span>
      <button :disabled="offset + PAGE >= total" @click="page(1)">Next →</button>
    </div>
  </div>
</template>
