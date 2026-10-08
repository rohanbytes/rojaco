async function loadStores(){
  try{
    const res = await fetch('/data/stores.json');
    const json = await res.json();
    const stores = json.stores || [];
    const grid = document.getElementById('store-grid');
    grid.innerHTML = stores.map(s => `
      <article class="store-card">
        <div class="card-head">
          <div>
            <h4 class="store-name">${s.name}</h4>
            <div class="muted">${s.address}</div>
          </div>
          <div class="meta">
            <div class="muted">Updated: ${s.last_updated}</div>
            <a class="view-btn" href="/stores/${s.slug}/">View</a>
          </div>
        </div>
        <div class="card-body">
          <p class="muted small">${s.items.length} items • License: ${s.license}</p>
        </div>
      </article>
    `).join('');

    // basic search
    document.getElementById('search').addEventListener('input', (e)=>{
      const q = e.target.value.toLowerCase().trim();
      const filtered = stores.filter(s => s.name.toLowerCase().includes(q) || s.items.some(i => i.name.toLowerCase().includes(q)));
      grid.innerHTML = filtered.map(s => `
        <article class="store-card">
          <div class="card-head">
            <div>
              <h4 class="store-name">${s.name}</h4>
              <div class="muted">${s.address}</div>
            </div>
            <div class="meta">
              <div class="muted">Updated: ${s.last_updated}</div>
              <a class="view-btn" href="/stores/${s.slug}/">View</a>
            </div>
          </div>
          <div class="card-body">
            <p class="muted small">${s.items.length} items • License: ${s.license}</p>
          </div>
        </article>
      `).join('');
    });

  }catch(err){
    console.error('Failed to load stores', err);
    document.getElementById('store-grid').innerHTML = '<div class="muted">Failed to load store data.</div>'
  }
}

loadStores();
