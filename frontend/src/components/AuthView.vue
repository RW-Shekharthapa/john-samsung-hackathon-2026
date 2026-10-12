<script setup>
import { ref } from 'vue'
import { api, session } from '../api'

const emit = defineEmits(['authed'])
const props = defineProps({ initialMode: { type: String, default: 'login' } })
const mode = ref(props.initialMode)
const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = 'Username and password are required'
    return
  }
  busy.value = true
  try {
    const res = await (mode.value === 'login' ? api.login : api.register)({
      username: username.value, password: password.value,
    })
    session.token = res.token
    emit('authed', res.user)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="card auth">
    <div class="tabs">
      <button :class="{ active: mode === 'login' }" @click="mode = 'login'; error = ''">Sign in</button>
      <button :class="{ active: mode === 'register' }" @click="mode = 'register'; error = ''">Create account</button>
    </div>
    <h2>{{ mode === 'login' ? 'Welcome back' : 'Join Orbit News' }}</h2>
    <form @submit.prevent="submit">
      <label for="u">Username</label>
      <input id="u" v-model="username" autocomplete="username" autofocus />
      <label for="p">Password</label>
      <input id="p" v-model="password" type="password"
             :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
      <div v-if="error" class="error">{{ error }}</div>
      <button class="primary" :disabled="busy">
        {{ busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account' }}
      </button>
    </form>
    <p class="hint">Demo account: <b>demo</b> / <b>demo1234</b></p>
  </div>
</template>
