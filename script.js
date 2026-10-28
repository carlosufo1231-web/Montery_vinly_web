// --- CONFIGURAÇÃO DO SUPABASE ---
const SUPABASE_URL = 'https://alvuyjjlwtedkpsooifq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdnV5ampsd3RlZGtwc29vaWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODQ2NDYsImV4cCI6MjEwNzc2MDY0Nn0.LC70eoUsh5lTE-XDrAJWfgYMIsHLEM1-U6LDcbNBwVk';

const supabaseClient = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

const fallbackCds = [
    {
        id: 'fallback-outros',
        title: 'Montery Vinil',
        subtitle: 'Identidade visual',
        category: 'outros',
        category_label: 'Outros',
        image_url: 'assets/logo-montery-vinil.jpg',
        description: 'A  Marca Surgiu Em Meados de 2022, quando a intençao inicial era criar uma marca que representasse a cultura e a identidade do Pará.',
        status: 'Entre Em Contato Para Saber Mais',
    }
];

// Variável global para guardar todos os CDs obtidos da base de dados
let allCds = [];
let allGenres = [];
let catalogRealtimeChannel = null;
let catalogRefreshTimer = null;
let activeFilterId = 'todos';

// --- ELEMENTOS DO DOM ---
const productGrid = document.getElementById('productGrid');
const filtersContainer = document.getElementById('catalogFilters');
const itemModal = document.getElementById('itemModal');
const modalClose = document.getElementById('modalClose');
const modalImage = document.getElementById('modalImage');
const modalImageLabel = document.getElementById('modalImageLabel');
const modalGalleryThumbnails = document.getElementById('modalGalleryThumbnails');
const modalTitle = document.getElementById('modalTitle');
const modalDescription = document.getElementById('modalDescription');
const modalStatus = document.getElementById('modalStatus');
const modalContact = document.getElementById('modalContact');
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
const yearSpan = document.getElementById('year');
let modalGalleryImages = [];

// Definir o ano atual no rodapé
if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
}

// --- MENU MOBILE ---
if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
        menuToggle.setAttribute('aria-expanded', !isExpanded);
        mainNav.classList.toggle('open');
    });
}

// --- BUSCAR CDS DO SUPABASE ---
async function fetchCds() {
    if (!productGrid) return;

    if (!supabaseClient) {
        allCds = fallbackCds;
        allGenres = [];
        renderFilters();
        renderCds(allCds);
        return;
    }

    try {
        const [cdsResult, genresResult] = await Promise.all([
            supabaseClient
                .from('cds')
                .select('*')
                .order('created_at', { ascending: false }),
            supabaseClient
                .from('Generos')
                .select('id, nome')
                .order('nome', { ascending: true })
        ]);

        if (cdsResult.error) throw cdsResult.error;
        if (genresResult.error) {
            console.error('Erro ao carregar gêneros:', genresResult.error);
        }

        allCds = cdsResult.data && cdsResult.data.length > 0
            ? cdsResult.data
            : fallbackCds;
        allGenres = genresResult.error ? [] : genresResult.data || [];
        renderFilters();
        renderCds(allCds);
    } catch (err) {
        console.error('Erro ao carregar catálogo e gêneros:', err);
        allCds = fallbackCds;
        allGenres = [];
        renderFilters();
        renderCds(allCds);
    }
}

function subscribeToCatalogChanges() {
    if (!supabaseClient || catalogRealtimeChannel) return;

    catalogRealtimeChannel = supabaseClient
        .channel('public-cds-catalog')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'cds' },
            () => {
                window.clearTimeout(catalogRefreshTimer);
                catalogRefreshTimer = window.setTimeout(fetchCds, 150);
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Generos' },
            () => {
                window.clearTimeout(catalogRefreshTimer);
                catalogRefreshTimer = window.setTimeout(fetchCds, 150);
            }
        )
        .subscribe((status, error) => {
            if (
                status === 'CHANNEL_ERROR' ||
                status === 'TIMED_OUT' ||
                status === 'CLOSED'
            ) {
                console.error(
                    'Não foi possível receber atualizações em tempo real do catálogo:',
                    error || status
                );
            }
        });
}

// --- RENDERIZAR OS CARDS NA GRELHA ---
function renderCds(cds) {
    if (!productGrid) return;

    if (!cds || cds.length === 0) {
        productGrid.innerHTML = `<div class="empty-state">Nenhum disco encontrado nesta categoria.</div>`;
        return;
    }

    const visibleCds = activeFilterId === 'todos'
        ? cds
        : cds.filter(cd => getCdGenreId(cd) === activeFilterId);

    if (visibleCds.length === 0) {
        productGrid.innerHTML = `<div class="empty-state">Nenhum disco encontrado nesta categoria.</div>`;
        return;
    }

    productGrid.innerHTML = visibleCds.map(cd => `
        <div class="product-card" data-category="${cd.category}">
            <div class="product-image">
                <img src="${cd.image_url}" alt="${cd.title}" loading="lazy">
            </div>
            <div class="product-info">
                <span class="product-category">${getCdGenreName(cd)}</span>
                <h3>${cd.title}</h3>
                <p>${cd.subtitle || ''}</p>
                <button class="details-button" onclick="openModal('${cd.id}')">
                    Ver Detalhes
                </button>
            </div>
        </div>
    `).join('');
}

function normalizeCategory(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

const categoryAliases = {
    'ritmos regionais': 'ritmos-regionais',
    'ritmos paraenses': 'ritmos-regionais',
    'ritmo paraense': 'ritmos-regionais',
    'brega paraense': 'brega'
};

function getCanonicalCategory(value) {
    const normalized = normalizeCategory(value);
    return categoryAliases[normalized] || normalized.replace(/ /g, '-');
}

function getGenreForCd(cd) {
    if (cd.Genero_id !== null && cd.Genero_id !== undefined) {
        const genreById = allGenres.find(
            genre => String(genre.id) === String(cd.Genero_id)
        );
        if (genreById) return genreById;
    }

    const legacyCategory = getCanonicalCategory(cd.category || cd.category_label);
    return allGenres.find(
        genre => getCanonicalCategory(genre.nome) === legacyCategory
    ) || null;
}

function getCdGenreId(cd) {
    const genre = getGenreForCd(cd);
    return genre ? String(genre.id) : '';
}

function getCdGenreName(cd) {
    const genre = getGenreForCd(cd);
    return genre?.nome || cd.category_label || cd.category || 'Gênero não definido';
}

function renderFilters() {
    if (!filtersContainer) return;

    filtersContainer.replaceChildren();

    const allButton = document.createElement('button');
    allButton.className = 'filter';
    allButton.type = 'button';
    allButton.dataset.filter = 'todos';
    allButton.textContent = 'Todos os discos';
    allButton.classList.toggle('active', activeFilterId === 'todos');
    filtersContainer.append(allButton);

    allGenres.forEach(genre => {
        const button = document.createElement('button');
        button.className = 'filter';
        button.type = 'button';
        button.dataset.filter = String(genre.id);
        button.textContent = `♫ ${genre.nome}`;
        button.classList.toggle('active', activeFilterId === String(genre.id));
        filtersContainer.append(button);
    });

    if (
        activeFilterId !== 'todos' &&
        !allGenres.some(genre => String(genre.id) === activeFilterId)
    ) {
        activeFilterId = 'todos';
        allButton.classList.add('active');
    }
}

// --- SISTEMA DE FILTROS ---
filtersContainer.addEventListener('click', event => {
    const button = event.target.closest('.filter[data-filter]');
    if (!button) return;

    activeFilterId = button.dataset.filter;
    filtersContainer
        .querySelectorAll('.filter')
        .forEach(filter => filter.classList.toggle('active', filter === button));
    renderCds(allCds);
});

// --- ABRIR MODAL DE DETALHES ---
function showModalGalleryImage(index) {
    const image = modalGalleryImages[index];
    if (!image) return;

    modalImage.src = image.url;
    modalImage.alt = image.label || modalTitle.textContent;
    modalImageLabel.textContent = image.label || '';

    modalGalleryThumbnails
        .querySelectorAll('.modal-gallery-thumbnail')
        .forEach((button, buttonIndex) => {
            button.classList.toggle('active', buttonIndex === index);
            button.setAttribute('aria-pressed', buttonIndex === index);
        });
}

window.openModal = function(id) {
    const cd = allCds.find(item => item.id == id);
    if (!cd) return;

    modalTitle.textContent = cd.title + (cd.subtitle ? ` - ${cd.subtitle}` : '');
    modalDescription.textContent = cd.description || 'Nenhuma descrição detalhada informada para este exemplar.';
    modalStatus.textContent = cd.status || 'Consulte disponibilidade e valor';

    modalGalleryImages = [
        { url: cd.image_url, label: 'Capa' },
        ...(Array.isArray(cd.gallery_images)
            ? cd.gallery_images.filter(image => image && image.url)
            : [])
    ];
    modalGalleryThumbnails.replaceChildren();

    modalGalleryImages.forEach((image, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'modal-gallery-thumbnail';
        button.setAttribute(
            'aria-label',
            `Ver foto: ${image.label || `Foto ${index + 1}`}`
        );
        button.setAttribute('aria-pressed', 'false');

        const thumbnail = document.createElement('img');
        thumbnail.src = image.url;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';

        button.append(thumbnail);
        modalGalleryThumbnails.append(button);
    });
    showModalGalleryImage(0);
    
    // Link direto para WhatsApp / Instagram (pode personalizar com o seu número ou rede)
    const mensagem = encodeURIComponent(`Olá, tenho interesse no CD: ${cd.title}`);
    modalContact.href = `https://wa.me/5591985689295?text=${mensagem}`;

    itemModal.classList.add('open');
    itemModal.setAttribute('aria-hidden', 'false');
};

modalGalleryThumbnails.addEventListener('click', (event) => {
    const thumbnail = event.target.closest('.modal-gallery-thumbnail');
    if (!thumbnail) return;

    const index = [...modalGalleryThumbnails.children].indexOf(thumbnail);
    showModalGalleryImage(index);
});

// --- FECHAR MODAL ---
function closeModal() {
    itemModal.classList.remove('open');
    itemModal.setAttribute('aria-hidden', 'true');
}

if (modalClose) {
    modalClose.addEventListener('click', closeModal);
}

// Fechar ao clicar fora do cartão modal (no fundo escuro)
if (itemModal) {
    itemModal.addEventListener('click', (e) => {
        if (e.target.getAttribute('data-close') === 'true') {
            closeModal();
        }
    });
}

// Fechar com a tecla ESC
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// --- INICIALIZAR AO CARREGAR A PÁGINA ---
document.addEventListener('DOMContentLoaded', () => {
    subscribeToCatalogChanges();
    fetchCds();
});