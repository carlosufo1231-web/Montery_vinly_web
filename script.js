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

// --- ELEMENTOS DO DOM ---
const productGrid = document.getElementById('productGrid');
const filterButtons = document.querySelectorAll('.filter');
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
        renderCds(allCds);
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('cds')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allCds = data && data.length > 0 ? data : fallbackCds;
        renderCds(allCds);
    } catch (err) {
        console.error('Erro ao carregar CDs:', err.message);
        allCds = fallbackCds;
        renderCds(allCds);
    }
}

// --- RENDERIZAR OS CARDS NA GRELHA ---
function renderCds(cds) {
    if (!productGrid) return;

    if (!cds || cds.length === 0) {
        productGrid.innerHTML = `<div class="empty-state">Nenhum disco encontrado nesta categoria.</div>`;
        return;
    }

    productGrid.innerHTML = cds.map(cd => `
        <div class="product-card" data-category="${cd.category}">
            <div class="product-image">
                <img src="${cd.image_url}" alt="${cd.title}" loading="lazy">
            </div>
            <div class="product-info">
                <span class="product-category">${cd.category_label || cd.category}</span>
                <h3>${cd.title}</h3>
                <p>${cd.subtitle || ''}</p>
                <button class="details-button" onclick="openModal('${cd.id}')">
                    Ver Detalhes
                </button>
            </div>
        </div>
    `).join('');
}

// --- SISTEMA DE FILTROS ---
filterButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remover classe ativa de todos
        filterButtons.forEach(btn => btn.classList.remove('active'));
        // Adicionar ao botão clicado
        button.classList.add('active');

        const filterValue = button.getAttribute('data-filter');

        if (filterValue === 'todos') {
            renderCds(allCds);
        } else {
            const filtered = allCds.filter(cd => cd.category === filterValue);
            renderCds(filtered);
        }
    });
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
    fetchCds();
});