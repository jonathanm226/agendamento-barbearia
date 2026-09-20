// === CONFIGURAÇÃO DO SUPABASE ===
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedBarber = "Willian";
let selectedService = "Corte de Cabelo";
let selectedPrice = 45;

const allTimes = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("date");
    if (dateInput) {
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.addEventListener("change", checkAvailableTimes);
    }
    checkAvailableTimes();
});

// Seleção de Barbeiro
function selectBarber(element, barberName) {
    document.querySelectorAll(".barber-card").forEach(card => card.classList.remove("active"));
    element.classList.add("active");
    selectedBarber = barberName;
    checkAvailableTimes();
}

// Seleção de Serviço
function selectService(element, serviceName, price) {
    document.querySelectorAll(".service-card").forEach(card => card.classList.remove("active"));
    element.classList.add("active");
    selectedService = serviceName;
    selectedPrice = price;
}

// Checa no Supabase quais horários já estão ocupados
async function checkAvailableTimes() {
    const dateElement = document.getElementById("date");
    const timeSelect = document.getElementById("time");

    if (!dateElement || !timeSelect) return;

    const selectedDate = dateElement.value;
    if (!selectedDate) return;

    try {
        const { data: agendamentos, error } = await _supabase
            .from("agendamentos")
            .select("horario")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (error) throw error;

        const occupiedTimes = agendamentos.map(a => a.horario);
        timeSelect.innerHTML = "";

        allTimes.forEach(time => {
            const option = document.createElement("option");
            option.value = time;

            if (occupiedTimes.includes(time)) {
                option.textContent = `${time} - (Indisponível)`;
                option.disabled = true;
            } else {
                option.textContent = time;
            }

            timeSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Erro ao buscar agendamentos:", err);
    }
}

// Envia para o WhatsApp e grava o agendamento no Supabase
async function sendToWhatsapp() {
    const nameInput = document.getElementById("client-name");
    const dateInput = document.getElementById("date");
    const timeSelect = document.getElementById("time");
    const btnAgendar = document.getElementById("btn-agendar");

    const name = nameInput ? nameInput.value.trim() : "";
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";

    if (!name) {
        alert("Por favor, digite seu nome antes de prosseguir.");
        return;
    }

    if (!time) {
        alert("Nenhum horário selecionado ou todos os horários estão ocupados nessa data.");
        return;
    }

    if (btnAgendar) {
        btnAgendar.disabled = true;
        btnAgendar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agendando...';
    }

    // Prepara a mensagem do WhatsApp
    const formattedDate = date.split("-").reverse().join("/");
    const whatsappNumber = "5531994951564";

    const message = `Olá! Gostaria de agendar um horário:\n\n` +
                    `*Cliente:* ${name}\n` +
                    `*Barbeiro:* ${selectedBarber}\n` +
                    `*Serviço:* ${selectedService} (R$ ${selectedPrice},00)\n` +
                    `*Data:* ${formattedDate}\n` +
                    `*Horário:* ${time}`;

    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    // Grava no Supabase em segundo plano
    try {
        const { error } = await _supabase
            .from("agendamentos")
            .insert([
                {
                    cliente: name,
                    barbeiro: selectedBarber,
                    servico: selectedService,
                    data: date,
                    horario: time
                }
            ]);

        if (error) {
            console.error("Erro no Supabase:", error);
            alert("Atenção: Seu agendamento foi direcionado para o WhatsApp, mas houve um problema ao salvar no banco de dados.");
        }
    } catch (err) {
        console.error(err);
    }

    // Atualiza a lista de horários
    await checkAvailableTimes();

    if (btnAgendar) {
        btnAgendar.disabled = false;
        btnAgendar.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Agendar pelo WhatsApp';
    }

    // Redireciona diretamente para o WhatsApp
    window.location.href = link;
}