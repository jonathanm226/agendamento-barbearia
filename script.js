// === CONFIGURAÇÃO DO SUPABASE ===
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedBarber = "Willian";
let selectedServices = []; 

// A partir deste horário (inclusive), o agendamento é considerado "Corte Emergencial"
const HORARIO_EMERGENCIAL_INICIO = "19:30";
const VALOR_CORTE_EMERGENCIAL = 50;

// Compara horários no formato "HH:MM" (funciona por comparação de string, pois é zero-padded)
function isHorarioEmergencial(horario) {
    return !!horario && horario >= HORARIO_EMERGENCIAL_INICIO;
}

// Dicionário com a duração de cada serviço em minutos
const duracoesServicos = {
    "Corte": 30,
    "Barba": 30,
    "Sobrancelha": 15,
    "Acabamento": 15,
    "Pigmentação": 20,
    "Alisamento": 40,
    "Hidratação": 20,
    "Selagem": 45,
    "Luzes": 60,
    "Platinado": 90
};

document.addEventListener("DOMContentLoaded", () => {
    const dateInput = document.getElementById("date");
    if (dateInput) {
        const todayObj = new Date();
        const todayStr = todayObj.toISOString().split("T")[0];
        
        // Define a data mínima como hoje e máxima de 3 semanas (21 dias)
        dateInput.min = todayStr;
        const maxDateObj = new Date();
        maxDateObj.setDate(todayObj.getDate() + 21);
        dateInput.max = maxDateObj.toISOString().split("T")[0];

        dateInput.value = todayStr;
        dateInput.addEventListener("change", checkAvailableTimes);
    }
    checkAvailableTimes();
});

// Função para selecionar o barbeiro
function selectBarber(element, barberName) {
    document.querySelectorAll(".barber-card").forEach(card => card.classList.remove("active"));
    element.classList.add("active");
    selectedBarber = barberName;
    checkAvailableTimes();
}

// Função para marcar/desmarcar serviços e atualizar horários instantaneamente
function toggleService(element, serviceName, price) {
    const icon = element.querySelector(".checkbox-icon");
    const index = selectedServices.findIndex(s => s.name === serviceName);
    const duration = duracoesServicos[serviceName] || 30;

    if (index > -1) {
        selectedServices.splice(index, 1);
        element.classList.remove("active");
        if (icon) {
            icon.classList.remove("fa-solid", "fa-square-check");
            icon.classList.add("fa-regular", "fa-square");
        }
    } else {
        selectedServices.push({ name: serviceName, price: price, duration: duration });
        element.classList.add("active");
        if (icon) {
            icon.classList.remove("fa-regular", "fa-square");
            icon.classList.add("fa-solid", "fa-square-check");
        }
    }
    
    checkAvailableTimes();
}

// Lógica de horários disponíveis (intervalos de 30 minutos)
function getTimesForDate(dateString) {
    if (!dateString) return [];
    
    const partes = dateString.split('-');
    const dataObj = new Date(partes[0], partes[1] - 1, partes[2]);
    const diaSemana = dataObj.getDay(); 

    let horarios = [];

    if (diaSemana === 0) { // Domingo
        return [];
    } else if (diaSemana === 6) { // Sábado (05:00 às 13:00)
        for (let h = 5; h < 13; h++) {
            horarios.push(h < 10 ? `0${h}:00` : `${h}:00`);
            horarios.push(h < 10 ? `0${h}:30` : `${h}:30`);
        }
        horarios.push("13:00");
    } else { // Segunda a Sexta (07:00 às 19:00 normal, 19:30 às 21:00 corte emergencial)
        for (let h = 7; h < 21; h++) {
            horarios.push(h < 10 ? `0${h}:00` : `${h}:00`);
            horarios.push(h < 10 ? `0${h}:30` : `${h}:30`);
        }
        horarios.push("21:00");
    }
    return horarios;
}

// Verifica horários livres considerando a duração total dos serviços selecionados
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

    const totalDurationMinutes = selectedServices.reduce((acc, s) => acc + s.duration, 0) || 30;
    const slotsNeeded = Math.ceil(totalDurationMinutes / 30);

    try {
        const { data: agendamentos, error: errAgendamentos } = await _supabase
            .from("agendamentos")
            .select("horario, status, servico")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (errAgendamentos) throw errAgendamentos;

        const { data: bloqueios, error: errBloqueios } = await _supabase
            .from("bloqueios_agenda")
            .select("horario")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (errBloqueios) throw errBloqueios;

        let occupiedTimes = [];
        if (agendamentos) {
            agendamentos.filter(a => a.status !== 'cancelado').forEach(a => {
                occupiedTimes.push(a.horario);
                if (a.servico) {
                    let duracaoAntiga = 0;
                    a.servico.split(",").forEach(serv => {
                        const nomeS = serv.trim();
                        duracaoAntiga += duracoesServicos[nomeS] || 30;
                    });
                    const slotsAntigos = Math.ceil(duracaoAntiga / 30);
                    const idxInicio = allTimes.indexOf(a.horario);
                    if (idxInicio !== -1) {
                        for (let k = 1; k < slotsAntigos; k++) {
                            if (allTimes[idxInicio + k]) {
                                occupiedTimes.push(allTimes[idxInicio + k]);
                            }
                        }
                    }
                }
            });
        }

        const blockedTimes = bloqueios ? bloqueios.map(b => b.horario) : [];

        if (blockedTimes.includes("TODOS")) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Agenda fechada neste dia";
            option.disabled = true;
            timeSelect.appendChild(option);
            return;
        }

        allTimes.forEach((time, index) => {
            const option = document.createElement("option");
            option.value = time;

            let temConflito = false;

            if (index + slotsNeeded > allTimes.length) {
                temConflito = true;
            } else {
                for (let i = 0; i < slotsNeeded; i++) {
                    const slotAtual = allTimes[index + i];
                    if (occupiedTimes.includes(slotAtual) || blockedTimes.includes(slotAtual)) {
                        temConflito = true;
                        break;
                    }
                }
            }

            const emergencial = isHorarioEmergencial(time);

            if (temConflito) {
                option.textContent = emergencial
                    ? `${time} 🚨 Corte Emergencial - (Indisponível)`
                    : `${time} - (Indisponível para esta duração)`;
                option.disabled = true;
            } else {
                option.textContent = emergencial
                    ? `${time} 🚨 Corte Emergencial (R$ ${VALOR_CORTE_EMERGENCIAL},00)`
                    : time;
            }

            timeSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Erro ao buscar disponibilidade:", err);
    }
}

// Busca os dados do cliente por telemóvel e gere a visibilidade da data de nascimento
async function buscarClientePorTelefone() {
    const telefoneInput = document.getElementById("client-phone").value.trim();
    const groupNasc = document.getElementById("group-nascimento");
    
    if (!telefoneInput) {
        if (groupNasc) groupNasc.style.display = "block";
        return;
    }

    const telefoneLimpo = telefoneInput.replace(/\D/g, '');
    if (telefoneLimpo.length < 8) {
        if (groupNasc) groupNasc.style.display = "block";
        return;
    }

    try {
        const { data, error } = await _supabase
            .from("agendamentos")
            .select("cliente, telefone, nascimento");

        if (error) throw error;

        if (data && data.length > 0) {
            const registrosCliente = data.filter(item => item.telefone && item.telefone.replace(/\D/g, '') === telefoneLimpo);
            
            if (registrosCliente.length > 0) {
                // Preenche o nome se encontrar
                const comNome = registrosCliente.find(item => item.cliente);
                if (comNome && comNome.cliente) {
                    document.getElementById("client-name").value = comNome.cliente;
                }

                // Verifica se já tem data de nascimento guardada
                const comNascimento = registrosCliente.find(item => item.nascimento);

                if (comNascimento && comNascimento.nascimento) {
                    document.getElementById("client-nascimento").value = comNascimento.nascimento;
                    if (groupNasc) {
                        groupNasc.style.display = "none"; // Oculta se já tiver preenchido antes
                    }
                } else {
                    if (groupNasc) {
                        groupNasc.style.display = "block"; // Mostra se estiver vazio
                    }
                }
            } else {
                // Cliente não encontrado (novo)
                if (groupNasc) groupNasc.style.display = "block";
            }
        } else {
            if (groupNasc) groupNasc.style.display = "block";
        }
    } catch (err) {
        console.error("Erro ao buscar cliente:", err);
        if (groupNasc) groupNasc.style.display = "block";
    }
}

// Finaliza o agendamento e envia para o WhatsApp
async function sendToWhatsapp() {
    const nameInput = document.getElementById("client-name");
    const phoneInput = document.getElementById("client-phone");
    const nascimentoInput = document.getElementById("client-nascimento");
    const dateInput = document.getElementById("date");
    const timeSelect = document.getElementById("time");
    const btnAgendar = document.getElementById("btn-agendar");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const nascimento = nascimentoInput ? nascimentoInput.value : null; 
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";

    if (!name || !phone) {
        alert("Por favor, digite o seu nome e telemóvel antes de prosseguir.");
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
        btnAgendar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A agendar...';
    }

    let precoTotal = 0;
    let listaNomesServicos = selectedServices.map(s => {
        precoTotal += s.price;
        return s.name;
    }).join(", ");

    const emergencial = isHorarioEmergencial(time);
    if (emergencial) {
        precoTotal = VALOR_CORTE_EMERGENCIAL;
    }

    const formattedDate = date.split("-").reverse().join("/");
    const whatsappNumber = "5531994951564";

    const avisoEmergencial = emergencial
        ? `🚨 *HORÁRIO EMERGENCIAL (fora do expediente normal)* 🚨\n\n`
        : "";

    const message = `${avisoEmergencial}✅ *AGENDAMENTO CONFIRMADO!* ✅\n\nOlá! Segue a confirmação do meu horário:\n\n👤 *Cliente:* ${name}\n📱 *Telefone:* ${phone}\n💈 *Barbeiro:* ${selectedBarber}\n✂️ *Serviços:* ${listaNomesServicos}${emergencial ? " (Corte Emergencial)" : ""} (Total: R$ ${precoTotal},00)\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${time}`;

    const link = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    try {
        const { error } = await _supabase
            .from("agendamentos")
            .insert([
                {
                    cliente: name,
                    telefone: phone,
                    nascimento: nascimento,
                    barbeiro: selectedBarber,
                    servico: listaNomesServicos,
                    data: date,
                    horario: time,
                    status: 'ativo'
                }
            ]);

        if (error) {
            console.error("Erro no Supabase:", error);
            alert("Atenção: O seu agendamento foi direcionado para o WhatsApp, mas houve um problema ao guardar no banco de dados.");
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
