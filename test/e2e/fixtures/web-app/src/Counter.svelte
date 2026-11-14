<script lang="ts">
  export let initialCount: number = 0;
  export let step: number = 1;

  let count = initialCount;

  function increment() {
    count += step;
  }

  function decrement() {
    count -= step;
  }

  function reset() {
    count = initialCount;
  }
</script>

<main class="counter-card p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border border-gray-100 text-center">
  <h2 class="counter-title text-xl font-bold text-gray-800 mb-2">Interactive Counter</h2>
  <div class="counter-display text-4xl font-extrabold text-blue-600 my-4" data-testid="count-value">
    {count}
  </div>
  <div class="counter-controls flex justify-center space-x-3">
    <button
      class="btn-decrement px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded hover:bg-gray-300"
      on:click={decrement}
      aria-label="Decrement counter"
    >
      -
    </button>
    <button
      class="btn-reset px-3 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 text-sm"
      on:click={reset}
    >
      Reset
    </button>
    <button
      class="btn-increment px-4 py-2 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700"
      on:click={increment}
      aria-label="Increment counter"
    >
      +
    </button>
  </div>
</main>

<style>
  .counter-card {
    transition: transform 0.2s ease;
  }
</style>
