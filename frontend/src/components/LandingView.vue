<script setup>
defineProps({ user: Object })
defineEmits(['go'])
</script>

<template>
  <div class="container">
    <section class="hero">
      <h1>Your space &amp; science news, in one place</h1>
      <p>Live headlines from the Spaceflight News API. Save the stories you care about and
        manage your own reading list — add, edit and remove articles any time.</p>
      <div class="actions">
        <template v-if="user">
          <button class="primary" @click="$emit('go', 'feed')">Browse live feed</button>
          <button @click="$emit('go', 'mine')">My articles</button>
        </template>
        <template v-else>
          <button class="primary" @click="$emit('go', 'register')">Get started</button>
          <button @click="$emit('go', 'login')">Sign in</button>
        </template>
      </div>
    </section>
    <section class="features">
      <div class="card"><h3>Live feed</h3><p>Fresh articles pulled from a free public news API, with search and paging.</p></div>
      <div class="card"><h3>Save &amp; organise</h3><p>One click saves any story to your personal list.</p></div>
      <div class="card"><h3>Full control</h3><p>Create your own entries, edit saved ones, and delete what you no longer need.</p></div>
      <div class="card"><h3>Private</h3><p>Your list is tied to your account and never visible to other users.</p></div>
    </section>
  </div>
</template>
