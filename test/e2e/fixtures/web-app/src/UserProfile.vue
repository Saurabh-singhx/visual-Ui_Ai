<template>
  <div class="user-profile-card p-6 bg-white rounded-xl shadow-lg border border-slate-100 flex flex-col items-center">
    <div class="avatar-wrapper relative mb-4">
      <img
        class="w-24 h-24 rounded-full object-cover ring-4 ring-indigo-50"
        :src="avatarUrl"
        :alt="username"
      />
      <span class="status-indicator absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full"></span>
    </div>
    <h2 class="username text-xl font-bold text-slate-800">{{ username }}</h2>
    <p class="user-role text-sm text-slate-500 mb-4">{{ role }}</p>
    <div class="profile-stats flex space-x-6 mb-6">
      <div class="stat-item text-center">
        <span class="block text-lg font-bold text-slate-700">{{ projectsCount }}</span>
        <span class="text-xs text-slate-400 uppercase tracking-wider">Projects</span>
      </div>
      <div class="stat-item text-center">
        <span class="block text-lg font-bold text-slate-700">{{ followersCount }}</span>
        <span class="text-xs text-slate-400 uppercase tracking-wider">Followers</span>
      </div>
    </div>
    <div class="profile-actions flex space-x-3 w-full">
      <button
        class="btn-primary flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-sm transition-colors"
        @click="handleFollow"
      >
        Follow
      </button>
      <button
        class="btn-message py-2 px-4 border border-slate-200 text-slate-700 font-medium rounded-lg text-sm hover:bg-slate-50"
        @click="handleMessage"
      >
        Message
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'UserProfile',
  props: {
    username: { type: String, default: 'Jane Doe' },
    role: { type: String, default: 'Principal Frontend Architect' },
    avatarUrl: { type: String, default: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330' },
    projectsCount: { type: Number, default: 28 },
    followersCount: { type: Number, default: 1420 },
  },
  methods: {
    handleFollow() {
      this.$emit('follow', this.username);
    },
    handleMessage() {
      this.$emit('message', this.username);
    },
  },
};
</script>

<style scoped>
.user-profile-card {
  max-width: 320px;
}
</style>
