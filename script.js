// === CONFIGURAÇÃO DO SUPABASE ===
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedBarber = "Willian";
let selectedServices = []; 

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("date");
    if (dateInput) {
        const today = new Date().toISOString().split("T")[0];
        dateInput.value = today;
        dateInput.addEventListener("change", checkAvailableTimes);
    }
    checkAvailableTimes();
});

function selectBarber(element, barberName) {
    document.querySelectorAll(".barber-card").forEach(card => card.classList.remove("active"));
    element.classList.add("active");
    selectedBarber = barberName;
    checkAvailableTimes();
}

function toggleService(element, serviceName, price) {
    const icon = element.querySelector(".checkbox-icon");
    const index = selectedServices.findIndex(s => s.name === serviceName);

    if (index > -1) {
        selectedServices.splice(index, 1);
        element.classList.remove("active");
        if (icon) {
            icon.classList.remove("fa-solid", "fa-square-check");
            icon.classList.add("fa-regular", "fa-square");
        }
    } else {
        selectedServices.push({ name: serviceName, price: price });
        element.classList.add("active");
        if (icon) {
            icon.classList.remove("fa-regular", "fa-square");
            icon.classList.add("fa-solid", "fa-square-check");
        }
    }
}

function getTimesForDate(dateString) {
    if (!dateString) return [];
    
    const partes = dateString.split('-');
    const dataObj = new Date(partes[0], partes[1] - 1, partes[2]);
    const diaSemana = dataObj.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

    let horarios = [];

    // Domingo (0): Fechado
    if (diaSemana === 0) {
        return [];
    } 
    // Sábado (6): 05:00 às 13:00
    else if (diaSemana === 6) {
        for (let h = 5; h <= 13; h++) {
            horarios.push(h < 10 ? `0${h}:00` : `${h}:00`);
        }
    } 
    // Segunda a Sexta (1 a 5): 07:00 às 19:00
    else {
        for (let h = 7; h <= 19; h++) {
            horarios.push(h < 10 ? `0${h}:00` : `${h}:00`);
        }
    }

    return horarios;
}

async function checkAvailableTimes() {
    const dateElement = document.getElementById("date");
    const timeSelect = document.getElementById("time");

    if (!dateElement || !timeSelect) return;

    const selectedDate = dateElement.value;
    if (!selectedDate) return;

    const allTimes = getTimesForDate(selectedDate);
    timeSelect.innerHTML = "";

    if (allTimes.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Fechado neste dia";
        option.disabled = true;
        timeSelect.appendChild(option);
        return;
    }

    try {
        const { data: agendamentos, error } = await _supabase
            .from("agendamentos")
            .select("horario")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (error) throw error;

        const occupiedTimes = agendamentos.map(a => a.horario);

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

    if (!time || timeSelect.selectedOptions[0]?.disabled) {
        alert("Por favor, selecione um horário válido e disponível.");
        return;
    }

    if (btnAgendar) {
        btnAgendar.disabled = true;
        btnAgendar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Agendando...';
    }

    let precoTotal = 0;
    let listaNomesServicos = selectedServices.map(s => {
        precoTotal += s.price;
        return s.name;
    }).join(", ");

    const formattedDate = date.split("-").reverse().join("/");
    
    // Novo número de atendimento configurado
    const whatsappNumber = "5531975552202";

    const message = `Olá! Gostaria de agendar um horário:\n\n` +
                    `*Cliente:* ${name}\n` +
                    `*Telefone:* ${phone}\n` +
                    `*Barbeiro:* ${selectedBarber}\n` +
                    `*Serviços:* ${listaNomesServicos} (Total: R$ ${precoTotal},00)\n` +
                    `*Data:* ${formattedDate}\n` +
                    `*Horário:* ${time}`;

    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    try {
        const { error } = await _supabase
            .from("agendamentos")
            .insert([
                {
                    cliente: name,
                    telefone: phone,
                    barbeiro: selectedBarber,
                    servico: listaNomesServicos,
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
