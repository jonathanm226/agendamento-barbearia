// === CONFIGURAÇÃO DO SUPABASE ===
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedBarber = "Willian";
let selectedServices = []; // Agora armazena uma lista de serviços selecionados

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

// Alternar Seleção de Múltiplos Serviços
function toggleService(element, serviceName, price) {
    const icon = element.querySelector(".checkbox-icon");
    
    // Verifica se já está selecionado
    const index = selectedServices.findIndex(s => s.name === serviceName);

    if (index > -1) {
        // Remove se já estiver na lista
        selectedServices.splice(index, 1);
        element.classList.remove("active");
        if (icon) {
            icon.classList.remove("fa-solid", "fa-square-check");
            icon.classList.add("fa-regular", "fa-square");
        }
    } else {
        // Adiciona à lista
        selectedServices.push({ name: serviceName, price: price });
        element.classList.add("active");
        if (icon) {
            icon.classList.remove("fa-regular", "fa-square");
            icon.classList.add("fa-solid", "fa-square-check");
        }
    }
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
    const phoneInput = document.getElementById("client-phone");
    const dateInput = document.getElementById("date");
    const timeSelect = document.getElementById("time");
    const btnAgendar = document.getElementById("btn-agendar");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";

    if (!name || !phone) {
        alert("Por favor, digite seu nome e telefone antes de prosseguir.");
        return;
    }

    if (selectedServices.length === 0) {
        alert("Por favor, selecione pelo menos um serviço.");
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

    // Calcula o preço total e une os nomes dos serviços selecionados
    let precoTotal = 0;
    let listaNomesServicos = selectedServices.map(s => {
        precoTotal += s.price;
        return s.name;
    }).join(", ");

    const formattedDate = date.split("-").reverse().join("/");
    const whatsappNumber = "5531994951564";

    const message = `Olá! Gostaria de agendar um horário:\n\n` +
                    `*Cliente:* ${name}\n` +
                    `*Telefone:* ${phone}\n` +
                    `*Barbeiro:* ${selectedBarber}\n` +
                    `*Serviços:* ${listaNomesServicos} (Total: R$ ${precoTotal},00)\n` +
                    `*Data:* ${formattedDate}\n` +
                    `*Horário:* ${time}`;

    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    // Grava no Supabase salvando os serviços combinados
    try {
        const { error } = await _supabase
            .from("agendamentos")
            .insert([
                {
                    cliente: name,
                    telefone: phone,
                    barbeiro: selectedBarber,
                    servico: listaNomesServicos, // Salva todos os serviços escolhidos juntos
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

    await checkAvailableTimes();

    if (btnAgendar) {
        btnAgendar.disabled = false;
        btnAgendar.innerHTML = '<i class="fa-brands fa-whatsapp"></i> Agendar pelo WhatsApp';
    }

    window.location.href = link;
}
