<script setup>
import { ref, onMounted } from 'vue'
import { api, session, setUnauthorizedHandler } from './api'
import AuthView from './components/AuthView.vue'
import LandingView from './components/LandingView.vue'
import FeedView from './components/FeedView.vue'
import MyArticlesView from './components/MyArticlesView.vue'

const user = ref(null)
const view = ref('landing') // landing | login | register | feeds | mine
const ready = ref(false)
const toast = ref('')
let toastTimer

function notify(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2500)
}
function clearSession() {
  session.token = null
  user.value = null
  view.value = 'login'
}
function go(v) {
  if ((v === 'feed' || v === 'mine') && !user.value) v = 'login'
  view.value = v
}
function onAuthed(u) { user.value = u; view.value = 'feed' }
async function logout() {
  try { await api.logout() } catch { /* ignore */ }
  clearSession()
  view.value = 'landing'
}

setUnauthorizedHandler(clearSession)
onMounted(async () => {
  if (session.token) {
    try { user.value = (await api.me()).user } catch { session.token = null }
  }
  ready.value = true
})
</script>

<template>
  <template v-if="ready">
    <header class="nav">
      <div class="container">
        <span class="brand" @click="go('landing')">🚀 Orbit News</span>
        <template v-if="user">
          <button class="tab" :class="{ active: view === 'feed' }" @click="go('feed')">Live feed</button>
          <button class="tab" :class="{ active: view === 'mine' }" @click="go('mine')">My articles</button>
          <span>{{ user.username }}</span>
          <button @click="logout">Log out</button>
        </template>
        <template v-else>
          <button @click="go('login')">Sign in</button>
          <button class="primary" @click="go('register')">Sign up</button>
        </template>
      </div>
    </header>

    <LandingView v-if="view === 'landing'" :user="user" @go="go" />
    <AuthView v-else-if="view === 'login' || view === 'register'" :key="view" :initial-mode="view" @authed="onAuthed" />
    <FeedView v-else-if="view === 'feed'" @saved="notify" />
    <MyArticlesView v-else-if="view === 'mine'" @toast="notify" />
    <div v-if="toast" class="toast">{{ toast }}</div>
  </template>
</template>
