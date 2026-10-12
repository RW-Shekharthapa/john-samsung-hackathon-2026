<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'

const emit = defineEmits(['toast'])
const items = ref([])
const search = ref('')
const loading = ref(false)
const error = ref('')

const editing = ref(null) // null = closed; {} = new; {id,...} = edit
const form = ref({})
const formError = ref('')
const saving = ref(false)
const confirmDel = ref(null)

async function load() {
  loading.value = true
  error.value = ''
  try { items.value = await api.listArticles(search.value.trim()) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}

function openForm(a) {
  editing.value = a || {}
  form.value = { title: '', summary: '', url: '', imageUrl: '', source: '', ...(a || {}) }
  formError.value = ''
}
async function submit() {
  formError.value = ''
  if (!form.value.title?.trim()) { formError.value = 'Title is required'; return }
  saving.value = true
  try {
    if (editing.value.id) {
      await api.updateArticle(editing.value.id, form.value)
      emit('toast', 'Article updated')
    } else {
      await api.createArticle(form.value)
      emit('toast', 'Article created')
    }
    editing.value = null
    await load()
  } catch (e) { formError.value = e.message }
  finally { saving.value = false }
}
async function remove() {
  const a = confirmDel.value
  try {
    await api.deleteArticle(a.id)
    confirmDel.value = null
    emit('toast', 'Article deleted')
    await load()
  } catch (e) { error.value = e.message; confirmDel.value = null }
}
const fmt = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '')
onMounted(load)
</script>

<template>
  <div class="container">
    <div class="page-head">
      <h2>My articles</h2>
      <button class="primary" @click="openForm()">+ New article</button>
    </div>
    <form class="toolbar" @submit.prevent="load">
      <input v-model="search" placeholder="Search my articles…" />
      <button>Search</button>
    </form>
    <div v-if="error" class="error">{{ error }}</div>
    <div v-if="loading" class="loading">Loading…</div>
    <div v-else-if="!items.length" class="empty">
      {{ search ? 'No articles match your search.' : 'Nothing here yet — save a story from the live feed or create your own.' }}
    </div>
    <div v-else class="grid">
      <article v-for="a in items" :key="a.id" class="card article">
        <img v-if="a.imageUrl" :src="a.imageUrl" :alt="a.title" loading="lazy" />
        <div class="body">
          <div class="meta">{{ a.source || 'Custom' }} · {{ fmt(a.publishedAt || a.createdAt) }}</div>
          <h3>{{ a.title }}</h3>
          <p>{{ a.summary }}</p>
          <div class="row">
            <a v-if="a.url" :href="a.url" target="_blank" rel="noopener noreferrer">Read</a>
            <button @click="openForm(a)">Edit</button>
            <button class="danger" @click="confirmDel = a">Delete</button>
          </div>
        </div>
      </article>
    </div>

    <div v-if="editing" class="modal-bg" @click.self="editing = null">
      <form class="modal" @submit.prevent="submit">
        <h2>{{ editing.id ? 'Edit article' : 'New article' }}</h2>
        <label>Title *</label><input v-model="form.title" maxlength="300" />
        <label>Summary</label><textarea v-model="form.summary" rows="4" maxlength="5000"></textarea>
        <label>Link (URL)</label><input v-model="form.url" placeholder="https://…" />
        <label>Image (URL)</label><input v-model="form.imageUrl" placeholder="https://…" />
        <label>Source</label><input v-model="form.source" maxlength="120" />
        <div v-if="formError" class="error">{{ formError }}</div>
        <div class="actions">
          <button type="button" @click="editing = null">Cancel</button>
          <button class="primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
      </form>
    </div>

    <div v-if="confirmDel" class="modal-bg" @click.self="confirmDel = null">
      <div class="modal">
        <h2>Delete article?</h2>
        <p>“{{ confirmDel.title }}” will be permanently removed from your list.</p>
        <div class="actions">
          <button @click="confirmDel = null">Cancel</button>
          <button class="danger" @click="remove">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>
