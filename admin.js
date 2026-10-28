
"use strict";

// ==========================================
// CONFIGURAÇÃO DO SUPABASE
// Use a mesma URL e a mesma chave anon/public
// do seu projeto atual.
// ==========================================

const SUPABASE_URL = "https://alvuyjjlwtedkpsooifq.supabase.co";

// Cole aqui a mesma chave anon/public que você já utiliza.
// Não use uma chave service_role no navegador.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFsdnV5ampsd3RlZGtwc29vaWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxODQ2NDYsImV4cCI6MjEwNzc2MDY0Nn0.LC70eoUsh5lTE-XDrAJWfgYMIsHLEM1-U6LDcbNBwVk";

const supabaseClient = window.supabase && typeof window.supabase.createClient === "function"
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// ==========================================
// ELEMENTOS DA PÁGINA
// ==========================================

const loginCard = document.getElementById("loginCard");
const adminCard = document.getElementById("adminCard");

const loginForm = document.getElementById("loginForm");
const cdForm = document.getElementById("cdForm");

const loginFeedback = document.getElementById("loginFeedback");
const saveFeedback = document.getElementById("saveFeedback");
const inventoryFeedback = document.getElementById("inventoryFeedback");
const inventoryList = document.getElementById("inventoryList");
const genreForm = document.getElementById("genreForm");
const genreFeedback = document.getElementById("genreFeedback");
const genreLoadFeedback = document.getElementById("genreLoadFeedback");
const newGenreName = document.getElementById("newGenreName");
const btnAddGenre = document.getElementById("btnAddGenre");
const categorySelect = document.getElementById("category");

const btnLogin = document.getElementById("btnLogin");
const btnSave = document.getElementById("btnSave");
const btnCancelEdit = document.getElementById("btnCancelEdit");
const btnLogout = document.getElementById("btnLogout");

const imageFile = document.getElementById("imageFile");
const previewImage = document.getElementById("previewImage");
const coverPreview = document.getElementById("coverPreview");
const fileName = document.getElementById("fileName");
const galleryExisting = document.getElementById("galleryExisting");
const galleryUploadList = document.getElementById("galleryUploadList");
const addGalleryImage = document.getElementById("addGalleryImage");
const formHeading = document.getElementById("formHeading");
const formDescription = document.getElementById("formDescription");
const imageEditHint = document.getElementById("imageEditHint");

const pageTitle = document.getElementById("pageTitle");

let previewUrl = null;
let editingCd = null;
let inventoryCds = [];
let galleryImages = [];
let removedGalleryImages = [];
let adminRealtimeChannel = null;
let inventoryRefreshTimer = null;
let genres = [];

// Limite de upload: 5 MB.
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];

function normalizeCategory(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");
}

const categoryAliases = {
    "ritmos regionais": "ritmos-regionais",
    "ritmos paraenses": "ritmos-regionais",
    "ritmo paraense": "ritmos-regionais",
    "brega paraense": "brega"
};

function getCanonicalCategory(value) {
    const normalized = normalizeCategory(value);
    return categoryAliases[normalized] || normalized.replace(/ /g, "-");
}

function findGenreForCd(cd) {
    if (cd.Genero_id !== null && cd.Genero_id !== undefined) {
        const byId = genres.find((genre) => String(genre.id) === String(cd.Genero_id));
        if (byId) return byId;
    }

    const legacyCategory = getCanonicalCategory(cd.category || cd.category_label);
    return genres.find((genre) =>
        getCanonicalCategory(genre.nome) === legacyCategory
    ) || null;
}

function renderGenreOptions(selectedId = categorySelect.value) {
    categorySelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = genres.length
        ? "Selecione um gênero"
        : "Cadastre um gênero primeiro";
    categorySelect.append(placeholder);

    genres.forEach((genre) => {
        const option = document.createElement("option");
        option.value = String(genre.id);
        option.textContent = genre.nome;
        categorySelect.append(option);
    });

    categorySelect.disabled = genres.length === 0;
    categorySelect.value = genres.some((genre) => String(genre.id) === String(selectedId))
        ? String(selectedId)
        : "";
}

async function loadGenres() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from("Generos")
            .select("id, nome")
            .order("nome", { ascending: true });

        if (error) throw error;

        const selectedId = categorySelect.value;
        genres = data || [];
        renderGenreOptions(selectedId);
        showFeedback(genreLoadFeedback, "");
    } catch (error) {
        console.error("Erro ao carregar gêneros:", error);
        categorySelect.replaceChildren();
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Não foi possível carregar os gêneros";
        categorySelect.append(option);
        categorySelect.disabled = true;
        showFeedback(genreLoadFeedback, friendlyError(error), "error");
    }
}

async function createGenre(event) {
    event.preventDefault();

    const name = newGenreName.value.trim();
    if (!name) return;

    if (genres.some((genre) =>
        normalizeCategory(genre.nome) === normalizeCategory(name)
    )) {
        showFeedback(genreFeedback, "Esse gênero já está cadastrado.", "error");
        return;
    }

    btnAddGenre.disabled = true;
    btnAddGenre.textContent = "Adicionando...";
    showFeedback(genreFeedback, "");

    try {
        const { error } = await supabaseClient
            .from("Generos")
            .insert({ nome: name });

        if (error) throw error;

        await loadGenres();
        const createdGenre = genres.find((genre) =>
            normalizeCategory(genre.nome) === normalizeCategory(name)
        );
        if (createdGenre) categorySelect.value = String(createdGenre.id);

        newGenreName.value = "";
        showFeedback(genreFeedback, "Gênero adicionado e disponível para cadastro.", "success");
    } catch (error) {
        showFeedback(genreFeedback, friendlyError(error), "error");
    } finally {
        btnAddGenre.disabled = false;
        btnAddGenre.textContent = "Adicionar gênero";
    }
}

// ==========================================
// MENSAGENS
// ==========================================

function showFeedback(element, message, type = "") {
    element.textContent = message;
    element.className = "feedback";

    if (type) {
        element.classList.add(type);
    }
}

function friendlyError(error) {
    const message = error?.message || String(error);

    console.error("Detalhes do erro:", error);

    if (/gallery_images/i.test(message) && /(column|schema cache|does not exist|could not find)/i.test(message)) {
        return "A coluna da galeria ainda não existe. Execute no Supabase SQL Editor: ALTER TABLE public.cds ADD COLUMN IF NOT EXISTS gallery_images jsonb NOT NULL DEFAULT '[]'::jsonb;";
    }

    if (/row-level security|violates row-level security/i.test(message)) {
        return "Sem permissão para concluir esta operação. Verifique as políticas RLS da tabela cds ou do Storage.";
    }

    if (/bucket not found/i.test(message)) {
        return "O bucket 'capas' não foi encontrado. Confira o nome no Supabase Storage.";
    }

    if (/duplicate key/i.test(message)) {
        return "Já existe um registro com esse identificador. Verifique a tabela cds.";
    }

    if (/invalid login credentials/i.test(message)) {
        return "E-mail ou senha incorretos.";
    }

    if (/email not confirmed/i.test(message)) {
        return "Confirme seu e-mail antes de entrar.";
    }

    if (/failed to fetch|networkerror/i.test(message)) {
        return "Não foi possível conectar ao Supabase. Confira a internet e a URL do projeto.";
    }

    return "Não foi possível concluir a operação: " + message;
}

// ==========================================
// SESSÃO E AUTENTICAÇÃO
// ==========================================

async function checkUser() {
    if (!supabaseClient) {
        if (loginFeedback) {
            showFeedback(
                loginFeedback,
                "O Supabase não está disponível. Verifique a biblioteca e a configuração do projeto.",
                "error"
            );
        }
        return false;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data.session;

        loginCard.classList.toggle("hidden", !!session);
        adminCard.classList.toggle("hidden", !session);

        pageTitle.textContent = session
            ? "Gerenciamento da coleção"
            : "Acesso administrativo";

        if (session) {
            await loadGenres();
            await loadCds();
            subscribeToAdminChanges();
        } else if (inventoryList) {
            stopAdminChanges();
            inventoryList.replaceChildren();
            const message = document.createElement("p");
            message.className = "muted";
            message.textContent = "Entre no painel para visualizar os discos cadastrados.";
            inventoryList.append(message);
        }

        return !!session;
    } catch (error) {
        showFeedback(
            loginFeedback,
            "Não foi possível verificar sua sessão. Confira a conexão com o Supabase.",
            "error"
        );

        console.error("Erro ao verificar sessão:", error);
        return false;
    }
}

function renderInventory(cds) {
    inventoryCds = cds;
    inventoryList.replaceChildren();

    if (!cds.length) {
        const message = document.createElement("p");
        message.className = "muted";
        message.textContent = "Ainda não há discos cadastrados.";
        inventoryList.append(message);
        return;
    }

    cds.forEach((cd) => {
        const item = document.createElement("article");
        item.className = "inventory-item";

        const image = document.createElement("img");
        image.className = "inventory-cover";
        image.src = cd.image_url;
        image.alt = `Capa de ${cd.title}`;
        image.loading = "lazy";

        const details = document.createElement("div");
        details.className = "inventory-details";

        const title = document.createElement("h3");
        title.textContent = cd.title;

        const metadata = document.createElement("p");
        const genre = findGenreForCd(cd);
        metadata.textContent = [
            cd.subtitle,
            genre?.nome || cd.category_label || cd.category || "Gênero não definido"
        ].filter(Boolean).join(" · ");

        const actions = document.createElement("div");
        actions.className = "inventory-actions";

        const editButton = document.createElement("button");
        editButton.className = "btn-edit";
        editButton.type = "button";
        editButton.dataset.action = "edit";
        editButton.dataset.cdId = cd.id;
        editButton.textContent = "Editar";
        editButton.setAttribute("aria-label", `Editar ${cd.title}`);

        const deleteButton = document.createElement("button");
        deleteButton.className = "btn-delete";
        deleteButton.type = "button";
        deleteButton.dataset.action = "delete";
        deleteButton.dataset.cdId = cd.id;
        deleteButton.textContent = "Excluir CD";
        deleteButton.setAttribute("aria-label", `Excluir ${cd.title}`);

        details.append(title, metadata);
        actions.append(editButton, deleteButton);
        item.append(image, details, actions);
        inventoryList.append(item);
    });
}

async function loadCds() {
    if (!supabaseClient || !inventoryList) return;

    inventoryList.replaceChildren();
    const loading = document.createElement("p");
    loading.className = "muted";
    loading.textContent = "Carregando discos cadastrados...";
    inventoryList.append(loading);
    showFeedback(inventoryFeedback, "");

    try {
        const { data, error } = await supabaseClient
            .from("cds")
            .select("id, title, subtitle, category, category_label, image_url, description, gallery_images, Genero_id")
            .order("created_at", { ascending: false });

        if (error) throw error;
        renderInventory(data || []);
    } catch (error) {
        inventoryList.replaceChildren();
        showFeedback(
            inventoryFeedback,
            friendlyError(error),
            "error"
        );
    }
}

function subscribeToAdminChanges() {
    if (!supabaseClient || adminRealtimeChannel) return;

    adminRealtimeChannel = supabaseClient
        .channel("admin-cds-inventory")
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "cds" },
            () => {
                window.clearTimeout(inventoryRefreshTimer);
                inventoryRefreshTimer = window.setTimeout(loadCds, 150);
            }
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "Generos" },
            () => {
                window.clearTimeout(inventoryRefreshTimer);
                inventoryRefreshTimer = window.setTimeout(() => {
                    loadGenres();
                    loadCds();
                }, 150);
            }
        )
        .subscribe((status, error) => {
            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
            ) {
                console.error(
                    "Não foi possível receber atualizações em tempo real do painel:",
                    error || status
                );
            }
        });
}

function stopAdminChanges() {
    if (!adminRealtimeChannel || !supabaseClient) return;

    const channel = adminRealtimeChannel;
    adminRealtimeChannel = null;
    window.clearTimeout(inventoryRefreshTimer);

    supabaseClient.removeChannel(channel).then((status) => {
        if (status !== "ok") {
            console.error("Não foi possível encerrar o canal Realtime do painel:", status);
        }
    }).catch((error) => {
        console.error("Erro ao encerrar o canal Realtime do painel:", error);
    });
}

genreForm.addEventListener("submit", createGenre);

function setFormMode(cd = null) {
    editingCd = cd;
    const isEditing = !!cd;

    formHeading.textContent = isEditing ? "Editar CD" : "Cadastrar um CD";
    formDescription.textContent = isEditing
        ? "Atualize as informações do disco e salve as alterações."
        : "Preencha os dados abaixo para publicar o disco.";
    btnSave.innerHTML = isEditing
        ? 'Salvar alterações <span>↗</span>'
        : 'Publicar CD <span>↗</span>';
    btnCancelEdit.classList.toggle("hidden", !isEditing);
    imageFile.required = !isEditing;
    imageEditHint.classList.toggle("hidden", !isEditing);
}

function renderExistingGallery() {
    galleryExisting.replaceChildren();
    galleryExisting.classList.toggle("hidden", galleryImages.length === 0);

    galleryImages.forEach((photo, index) => {
        const row = document.createElement("div");
        row.className = "gallery-photo-row";

        const image = document.createElement("img");
        image.src = photo.url;
        image.alt = photo.label || `Foto adicional ${index + 1}`;
        image.loading = "lazy";

        const details = document.createElement("div");
        details.className = "gallery-photo-fields";

        const label = document.createElement("input");
        label.type = "text";
        label.className = "gallery-existing-label";
        label.maxLength = 80;
        label.value = photo.label || `Foto adicional ${index + 1}`;
        label.setAttribute("aria-label", `Identificação da foto ${index + 1}`);

        details.append(label);

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn-delete";
        removeButton.dataset.galleryIndex = index;
        removeButton.textContent = "Remover foto";
        removeButton.setAttribute("aria-label", `Remover ${label.textContent}`);

        row.append(image, details, removeButton);
        galleryExisting.append(row);
    });
}

function addGalleryUploadRow() {
    const row = document.createElement("div");
    row.className = "gallery-photo-row gallery-upload-row";

    const preview = document.createElement("img");
    preview.className = "gallery-upload-preview hidden";
    preview.alt = "Pré-visualização da foto adicional";

    const fields = document.createElement("div");
    fields.className = "gallery-photo-fields";

    const label = document.createElement("input");
    label.type = "text";
    label.className = "gallery-photo-label";
    label.maxLength = 80;
    label.placeholder = "Identificação (ex.: Contracapa)";
    label.setAttribute("aria-label", "Identificação da foto");

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.className = "gallery-upload-file";
    fileInput.accept = ALLOWED_TYPES.join(",");
    fileInput.setAttribute("aria-label", "Arquivo da foto adicional");

    fields.append(label, fileInput);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn-secondary";
    removeButton.dataset.removeUpload = "true";
    removeButton.textContent = "Remover";

    row.append(preview, fields, removeButton);
    galleryUploadList.append(row);
    return fileInput;
}

function beginEditing(cd) {
    document.getElementById("title").value = cd.title || "";
    document.getElementById("subtitle").value = cd.subtitle || "";
    const genre = findGenreForCd(cd);
    categorySelect.value = genre ? String(genre.id) : "";
    document.getElementById("description").value = cd.description || "";

    imageFile.value = "";
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
    previewImage.src = cd.image_url;
    previewImage.alt = `Capa atual de ${cd.title}`;
    previewImage.classList.remove("hidden");
    coverPreview.querySelector(".cover-placeholder").classList.add("hidden");
    fileName.textContent = "Capa atual. Escolha outra imagem para substituí-la.";

    galleryImages = Array.isArray(cd.gallery_images)
        ? cd.gallery_images.filter((photo) => photo && typeof photo.url === "string")
        : [];
    removedGalleryImages = [];
    galleryUploadList.replaceChildren();
    renderExistingGallery();

    setFormMode(cd);
    showFeedback(saveFeedback, "");
    if (!genre) {
        showFeedback(
            saveFeedback,
            "Este disco ainda não está associado a um gênero. Selecione um gênero antes de salvar.",
            "error"
        );
    }
    document.getElementById("cadastro").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function getStorageObjectPath(imageUrl) {
    if (typeof imageUrl !== "string" || !imageUrl) return null;

    try {
        const image = new URL(imageUrl);
        const project = new URL(SUPABASE_URL);
        const publicBucketPath = "/storage/v1/object/public/capas/";

        if (image.origin !== project.origin) return null;

        const pathStart = image.pathname.indexOf(publicBucketPath);
        if (pathStart === -1) return null;

        return image.pathname
            .slice(pathStart + publicBucketPath.length)
            .split("/")
            .map((segment) => decodeURIComponent(segment))
            .join("/");
    } catch (error) {
        console.error("Não foi possível interpretar a URL da capa:", error);
        return null;
    }
}

async function deleteCd(cdId, button) {
    const title = button.getAttribute("aria-label").replace(/^Excluir /, "");

    if (!window.confirm(`Tem certeza que deseja excluir "${title}" da vitrine?`)) {
        return;
    }

    button.disabled = true;
    button.textContent = "Excluindo...";
    showFeedback(inventoryFeedback, "");

    try {
        const { data: deletedRows, error } = await supabaseClient
            .from("cds")
            .delete()
            .eq("id", cdId)
            .select("id, image_url, gallery_images");

        if (error) throw error;
        if (!deletedRows || deletedRows.length === 0) {
            throw new Error(
                "O disco não foi excluído. Confira se existe uma política DELETE para seu usuário na tabela cds."
            );
        }

        if (editingCd && String(editingCd.id) === String(cdId)) {
            cdForm.reset();
        }

        await loadCds();

        const urlsToRemove = [
            deletedRows[0].image_url,
            ...(Array.isArray(deletedRows[0].gallery_images)
                ? deletedRows[0].gallery_images.map((photo) => photo.url)
                : [])
        ];
        const storagePaths = [...new Set(
            urlsToRemove
                .map(getStorageObjectPath)
                .filter(Boolean)
        )];

        if (storagePaths.length > 0) {
            const { error: storageError } = await supabaseClient.storage
                .from("capas")
                .remove(storagePaths);

            if (storageError) {
                showFeedback(
                    inventoryFeedback,
                    `O CD foi removido da vitrine, mas uma ou mais imagens permaneceram no Storage: ${friendlyError(storageError)}`,
                    "error"
                );
                return;
            }
        }

        showFeedback(
            inventoryFeedback,
            "CD excluído da vitrine com sucesso.",
            "success"
        );
    } catch (error) {
        showFeedback(inventoryFeedback, friendlyError(error), "error");
        await loadCds();
    }
}

inventoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cd-id][data-action]");
    if (!button || button.disabled) return;

    const cd = inventoryCds.find((item) => String(item.id) === button.dataset.cdId);
    if (!cd) return;

    if (button.dataset.action === "edit") {
        beginEditing(cd);
    } else if (button.dataset.action === "delete") {
        deleteCd(button.dataset.cdId, button);
    }
});

addGalleryImage.addEventListener("click", () => {
    const fileInput = addGalleryUploadRow();
    fileInput.click();
});

galleryUploadList.addEventListener("change", (event) => {
    const input = event.target.closest(".gallery-upload-file");
    if (!input) return;

    const file = input.files[0];
    const preview = input.closest(".gallery-upload-row")
        .querySelector(".gallery-upload-preview");

    if (preview.dataset.previewUrl) {
        URL.revokeObjectURL(preview.dataset.previewUrl);
        delete preview.dataset.previewUrl;
    }

    if (!file) {
        preview.removeAttribute("src");
        preview.classList.add("hidden");
        return;
    }

    if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
        input.value = "";
        preview.removeAttribute("src");
        delete preview.dataset.previewUrl;
        preview.classList.add("hidden");
        showFeedback(
            saveFeedback,
            !ALLOWED_TYPES.includes(file.type)
                ? "Fotos adicionais devem ser JPG, PNG ou WebP."
                : "Cada foto adicional deve ter no máximo 5 MB.",
            "error"
        );
        return;
    }

    preview.dataset.previewUrl = URL.createObjectURL(file);
    preview.src = preview.dataset.previewUrl;
    preview.classList.remove("hidden");
});

galleryUploadList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-upload]");
    if (button) {
        const row = button.closest(".gallery-upload-row");
        const preview = row.querySelector(".gallery-upload-preview");
        if (preview.dataset.previewUrl) {
            URL.revokeObjectURL(preview.dataset.previewUrl);
        }
        row.remove();
    }
});

galleryExisting.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-gallery-index]");
    if (!button) return;

    const [removedPhoto] = galleryImages.splice(
        Number(button.dataset.galleryIndex),
        1
    );
    removedGalleryImages.push(removedPhoto);
    renderExistingGallery();
});

galleryExisting.addEventListener("change", (event) => {
    const input = event.target.closest(".gallery-existing-label");
    if (!input) return;

    const row = input.closest(".gallery-photo-row");
    const index = [...galleryExisting.children].indexOf(row);
    if (galleryImages[index]) {
        galleryImages[index].label = input.value.trim() || "Foto adicional";
    }
});

// Monitorar alterações de autenticação.
if (supabaseClient && supabaseClient.auth) {
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (loginCard && adminCard) {
            loginCard.classList.toggle("hidden", !!session);
            adminCard.classList.toggle("hidden", !session);
        }

        pageTitle.textContent = session
            ? "Gerenciamento da coleção"
            : "Acesso administrativo";

        if (session) {
            if (event !== "INITIAL_SESSION") {
                loadCds();
            }
            subscribeToAdminChanges();
        } else {
            stopAdminChanges();
        }
    });
}

// ==========================================
// LOGIN
// ==========================================

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
        showFeedback(
            loginFeedback,
            "O Supabase não está disponível. Verifique a biblioteca e a configuração do projeto.",
            "error"
        );
        return;
    }

    showFeedback(loginFeedback, "");

    btnLogin.disabled = true;
    btnLogin.textContent = "Autenticando...";

    try {
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;

        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        loginForm.reset();
        showFeedback(loginFeedback, "");
        await checkUser();

    } catch (error) {
        showFeedback(loginFeedback, friendlyError(error), "error");
    } finally {
        btnLogin.disabled = false;
        btnLogin.innerHTML = 'Entrar no painel <span>→</span>';
    }
});

// ==========================================
// PRÉ-VISUALIZAÇÃO DA CAPA
// ==========================================

imageFile.addEventListener("change", () => {
    const file = imageFile.files[0];

    showFeedback(saveFeedback, "");

    if (!file && editingCd) {
        previewImage.src = editingCd.image_url;
        previewImage.classList.remove("hidden");
        coverPreview.querySelector(".cover-placeholder")
            .classList.add("hidden");
        fileName.textContent = "Capa atual. Escolha outra imagem para substituí-la.";
        return;
    }

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    previewImage.removeAttribute("src");
    previewImage.classList.add("hidden");

    coverPreview.querySelector(".cover-placeholder")
        .classList.remove("hidden");

    if (!file) {
        fileName.textContent = "Nenhuma imagem selecionada.";
        return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
        imageFile.value = "";
        fileName.textContent = "Formato não permitido.";

        showFeedback(
            saveFeedback,
            "Escolha uma imagem JPG, PNG ou WebP.",
            "error"
        );

        return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
        imageFile.value = "";
        fileName.textContent = "Imagem muito grande.";

        showFeedback(
            saveFeedback,
            "A imagem deve ter no máximo 5 MB.",
            "error"
        );

        return;
    }

    previewUrl = URL.createObjectURL(file);

    previewImage.src = previewUrl;
    previewImage.classList.remove("hidden");

    coverPreview.querySelector(".cover-placeholder")
        .classList.add("hidden");

    fileName.textContent =
        `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
});

// ==========================================
// CADASTRO DO CD
// ==========================================

cdForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    showFeedback(saveFeedback, "");

    const title = document.getElementById("title").value.trim();
    const subtitle = document.getElementById("subtitle").value.trim();
    const genreId = categorySelect.value;
    const selectedGenre = genres.find(
        (genre) => String(genre.id) === String(genreId)
    );
    const description =
        document.getElementById("description").value.trim();

    const file = imageFile.files[0];
    const currentEdit = editingCd;
    const galleryUploadRows = [
        ...galleryUploadList.querySelectorAll(".gallery-upload-row")
    ];
    const galleryUploads = galleryUploadRows
        .map((row) => ({
            file: row.querySelector(".gallery-upload-file").files[0],
            label: row.querySelector(".gallery-photo-label").value.trim()
        }))
        .filter((photo) => photo.file);

    if (!title) {
        showFeedback(saveFeedback, "Informe o título do disco.", "error");
        return;
    }

    if (!selectedGenre) {
        showFeedback(saveFeedback, "Selecione um gênero cadastrado.", "error");
        return;
    }

    if (!file && !currentEdit) {
        showFeedback(saveFeedback, "Selecione a capa do disco.", "error");
        return;
    }

    if (file && !ALLOWED_TYPES.includes(file.type)) {
        showFeedback(saveFeedback, "Formato de imagem não permitido.", "error");
        return;
    }

    if (file && file.size > MAX_IMAGE_SIZE) {
        showFeedback(saveFeedback, "A imagem deve ter no máximo 5 MB.", "error");
        return;
    }

    const invalidGalleryUpload = galleryUploads.find(({ file: galleryFile }) =>
        !ALLOWED_TYPES.includes(galleryFile.type) ||
        galleryFile.size > MAX_IMAGE_SIZE
    );
    if (invalidGalleryUpload) {
        showFeedback(
            saveFeedback,
            !ALLOWED_TYPES.includes(invalidGalleryUpload.file.type)
                ? "Fotos adicionais devem ser JPG, PNG ou WebP."
                : "Cada foto adicional deve ter no máximo 5 MB.",
            "error"
        );
        return;
    }

    btnSave.disabled = true;
    btnSave.textContent = currentEdit ? "Salvando alterações..." : "Publicando...";

    const uploadedFileNames = [];
    let uploadedImageUrl = null;
    let recordSaved = false;

    try {
        // 1. Confirmar a sessão.
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
            throw new Error("Sua sessão expirou. Entre novamente no painel.");
        }

        let imageUrl = currentEdit ? currentEdit.image_url : null;

        if (file) {
            // Upload the replacement cover before changing the catalog row.
            const extension = file.name.split(".").pop().toLowerCase();
            const uniqueName = `${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await supabaseClient.storage
                .from("capas")
                .upload(uniqueName, file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: file.type
                });

            if (uploadError) throw uploadError;
                uploadedFileNames.push(uniqueName);

            const { data: publicData } = supabaseClient.storage
                .from("capas")
                .getPublicUrl(uniqueName);

            imageUrl = publicData.publicUrl;
            uploadedImageUrl = imageUrl;

            if (!imageUrl) {
                throw new Error("Não foi possível obter a URL pública da capa.");
            }
        }

        const uploadedGalleryImages = [];
        for (const photo of galleryUploads) {
            const extension = photo.file.name.split(".").pop().toLowerCase();
            const uniqueName = `${crypto.randomUUID()}.${extension}`;

            const { error: galleryUploadError } = await supabaseClient.storage
                .from("capas")
                .upload(uniqueName, photo.file, {
                    cacheControl: "3600",
                    upsert: false,
                    contentType: photo.file.type
                });

            if (galleryUploadError) throw galleryUploadError;
            uploadedFileNames.push(uniqueName);

            const { data: galleryPublicData } = supabaseClient.storage
                .from("capas")
                .getPublicUrl(uniqueName);
            const galleryUrl = galleryPublicData.publicUrl;

            if (!galleryUrl) {
                throw new Error(
                    `Não foi possível obter a URL da foto "${photo.file.name}".`
                );
            }

            uploadedGalleryImages.push({
                url: galleryUrl,
                label: photo.label || "Foto adicional"
            });
        }

        const cdData = {
            title,
            subtitle: subtitle || null,
            "Genero_id": selectedGenre.id,
            category: getCanonicalCategory(selectedGenre.nome),
            category_label: selectedGenre.nome,
            image_url: imageUrl,
            description: description || null,
            gallery_images: [
                ...(currentEdit ? galleryImages : []),
                ...uploadedGalleryImages
            ]
        };

        if (currentEdit) {
            const { data: updatedRows, error: updateError } = await supabaseClient
                .from("cds")
                .update(cdData)
                .eq("id", currentEdit.id)
                .select("id");

            if (updateError) throw updateError;
            if (!updatedRows || updatedRows.length === 0) {
                throw new Error(
                    "O disco não foi atualizado. Confira se existe uma política UPDATE para seu usuário na tabela cds."
                );
            }
        } else {
            const { error: insertError } = await supabaseClient
                .from("cds")
                .insert([{
                    ...cdData,
                    status: "Consulte disponibilidade e valor"
                }]);

            if (insertError) throw insertError;
        }

        recordSaved = true;
        await loadCds();

        const oldGalleryImagesToRemove = [...removedGalleryImages];
        const oldCoverUrl = currentEdit && uploadedImageUrl
            ? currentEdit.image_url
            : null;
        cdForm.reset();

        const oldImagePaths = [
            oldCoverUrl,
            ...oldGalleryImagesToRemove.map((photo) => photo.url)
        ].filter(Boolean).map(getStorageObjectPath).filter(Boolean);

        if (oldImagePaths.length > 0) {
            const { error: removeOldImagesError } = await supabaseClient.storage
                .from("capas")
                .remove([...new Set(oldImagePaths)]);

            if (removeOldImagesError) {
                showFeedback(
                    saveFeedback,
                    `Os dados foram salvos, mas uma ou mais fotos antigas permaneceram no Storage: ${friendlyError(removeOldImagesError)}`,
                    "error"
                );
                return;
            }
        }

        showFeedback(
            saveFeedback,
            currentEdit
                ? "CD atualizado com sucesso."
                : "CD cadastrado com sucesso! A capa foi enviada ao Storage.",
            "success"
        );

    } catch (error) {
        showFeedback(saveFeedback, friendlyError(error), "error");

        if (uploadedFileNames.length > 0 && !recordSaved) {
            const { error: cleanupError } = await supabaseClient.storage
                .from("capas")
                .remove(uploadedFileNames);

            if (cleanupError) {
                console.error(
                    "Não foi possível remover as imagens enviadas após falha no salvamento:",
                    cleanupError
                );
                showFeedback(
                    saveFeedback,
                    `${friendlyError(error)} Uma ou mais imagens novas também não puderam ser removidas do Storage; verifique as permissões DELETE do bucket.`,
                    "error"
                );
            }
        }
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = editingCd
            ? 'Salvar alterações <span>↗</span>'
            : 'Publicar CD <span>↗</span>';
    }
});

// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

cdForm.addEventListener("reset", () => {
    setFormMode();
    galleryImages = [];
    removedGalleryImages = [];
    galleryExisting.replaceChildren();
    galleryExisting.classList.add("hidden");
    galleryUploadList.querySelectorAll(".gallery-upload-preview").forEach((preview) => {
        if (preview.dataset.previewUrl) {
            URL.revokeObjectURL(preview.dataset.previewUrl);
        }
    });
    galleryUploadList.replaceChildren();
    showFeedback(saveFeedback, "");

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    previewImage.removeAttribute("src");
    previewImage.classList.add("hidden");

    coverPreview.querySelector(".cover-placeholder")
        .classList.remove("hidden");

    fileName.textContent = "Nenhuma imagem selecionada.";
});

btnCancelEdit.addEventListener("click", () => {
    cdForm.reset();
});

// ==========================================
// SAIR DO PAINEL
// ==========================================

btnLogout.addEventListener("click", async () => {
    btnLogout.disabled = true;

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) throw error;

        await checkUser();

    } catch (error) {
        showFeedback(saveFeedback, friendlyError(error), "error");
    } finally {
        btnLogout.disabled = false;
    }
});

// ==========================================
// ANO DO RODAPÉ E INICIALIZAÇÃO
// ==========================================

document.getElementById("year").textContent =
    new Date().getFullYear();

checkUser();
