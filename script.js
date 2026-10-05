// === CONFIGURAÇÃO DO SUPABASE ===
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let selectedBarber = "Willian";
let selectedServices = []; 

// Controla qual é a chamada mais recente de checkAvailableTimes
let requisicaoHorariosAtual = 0;

// A partir deste horário (inclusive), o agendamento é considerado "Corte Emergencial"
const HORARIO_EMERGENCIAL_INICIO = "19:00";
const VALOR_CORTE_EMERGENCIAL = 50;

// Compara horários no formato "HH:MM"
function isHorarioEmergencial(horario) {
    return !!horario && horario >= HORARIO_EMERGENCIAL_INICIO;
}

// Dicionário com a duração de cada serviço em minutos (padronizado)
const duracoesServicos = {
    "corte": 40, "corte de cabelo": 40, "barba": 20, "barba completa": 20,
    "combo cabelo + barba": 60, "sobrancelha": 10, "acabamento": 15,
    "pigmentacao": 20, "pigmentação": 20, "alisamento": 40,
    "hidratacao": 20, "hidratação": 20, "selagem": 45, "luzes": 60, "platinado": 90
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
    }
    checkAvailableTimes();
});

function toggleService(element, serviceName, price) {
    const icon = element.querySelector(".checkbox-icon");
    const index = selectedServices.findIndex(s => s.name === serviceName);
    
    const nomeNormalizado = serviceName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const duration = duracoesServicos[nomeNormalizado] || duracoesServicos[serviceName.toLowerCase()] || 40;

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

// Geração de horários base de 40 em 40 minutos
function getTimesForDate(dateString) {
    if (!dateString) return [];
    
    const partes = dateString.split('-');
    const dataObj = new Date(partes[0], partes[1] - 1, partes[2]);
    const diaSemana = dataObj.getDay(); 

    let horarios = [];

    if (diaSemana === 0) { // Domingo (Fechado)
        return [];
    } else { 
        let horaInicio = (diaSemana === 5 || diaSemana === 6) ? 5 : 7;
        let horaFim = 21;
        
        let currentMin = horaInicio * 60;
        let endMin = horaFim * 60;
        
        while (currentMin <= endMin) {
            let h = Math.floor(currentMin / 60);
            let m = currentMin % 60;
            horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            currentMin += 40; 
        }
    }

    // Remove horários que já passaram hoje (margem de 40 min)
    const agora = new Date();
    const hojeStr = agora.toISOString().split("T")[0];
    if (dateString === hojeStr) {
        const limite = new Date(agora.getTime() + 40 * 60000);
        const horaLimite = `${String(limite.getHours()).padStart(2, "0")}:${String(limite.getMinutes()).padStart(2, "0")}`;
        horarios = horarios.filter(h => h >= horaLimite);
    }

    return horarios;
}

// Transforma string "HH:MM" para número em minutos para cálculo rigoroso de colisões
function parseTimeStr(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
}

async function checkAvailableTimes() {
    const minhaRequisicao = ++requisicaoHorariosAtual;

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

    // Calcula total de minutos necessários pelos serviços escolhidos pelo cliente
    const totalDurationMinutes = selectedServices.reduce((acc, s) => acc + s.duration, 0) || 40;
    
    // Calcula o valor dinâmico para apresentar no option
    let precoEmergencialCalculado = VALOR_CORTE_EMERGENCIAL;
    let temSobrancelhaSelecionada = selectedServices.some(s => s.name.toLowerCase() === "sobrancelha");
    if (temSobrancelhaSelecionada) {
        precoEmergencialCalculado += 20;
    }

    const optionCarregando = document.createElement("option");
    optionCarregando.value = "";
    optionCarregando.textContent = "Carregando horários...";
    optionCarregando.disabled = true;
    timeSelect.appendChild(optionCarregando);

    try {
        const { data: agendamentos, error: errAgendamentos } = await _supabase
            .from("agendamentos")
            .select("*")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (errAgendamentos) throw errAgendamentos;
        if (minhaRequisicao !== requisicaoHorariosAtual) return;

        const { data: bloqueios, error: errBloqueios } = await _supabase
            .from("bloqueios_agenda")
            .select("horario")
            .eq("barbeiro", selectedBarber)
            .eq("data", selectedDate);

        if (errBloqueios) throw errBloqueios;
        if (minhaRequisicao !== requisicaoHorariosAtual) return;

        let occupiedIntervals = [];
        
        // Bloqueio de Almoço na Sexta-feira
        const [y, m, d] = selectedDate.split("-").map(Number);
        const dataSelecionadaObj = new Date(y, m - 1, d);
        if (dataSelecionadaObj.getDay() === 5) {
            occupiedIntervals.push({ start: 580, end: 740 });
        }

        if (agendamentos) {
            agendamentos.filter(a => !a.status || a.status.toLowerCase() !== 'cancelado').forEach(a => {
                if (a.horario) {
                    const startMin = parseTimeStr(a.horario);
                    let endMin;
                    
                    if (a.horario_fim) {
                        endMin = parseTimeStr(a.horario_fim);
                    } else {
                        let duracaoAgendada = 0;
                        if (a.servico) {
                            a.servico.split(",").forEach(serv => {
                                const nomeOriginal = serv.trim().toLowerCase();
                                const nomeNorm = nomeOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                duracaoAgendada += duracoesServicos[nomeNorm] || duracoesServicos[nomeOriginal] || 40;
                            });
                        }
                        if (duracaoAgendada === 0) duracaoAgendada = 40;
                        endMin = startMin + duracaoAgendada;
                    }
                    
                    occupiedIntervals.push({ start: startMin, end: endMin });
                }
            });
        }

        if (bloqueios) {
            bloqueios.forEach(b => {
                if (b.horario === "TODOS") {
                    occupiedIntervals.push({ start: 0, end: 1440 });
                } else if (b.horario) {
                    const startMin = parseTimeStr(b.horario);
                    occupiedIntervals.push({ start: startMin, end: startMin + 40 });
                }
            });
        }

        timeSelect.innerHTML = "";

        if (occupiedIntervals.some(i => i.start === 0 && i.end === 1440)) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Agenda fechada neste dia";
            option.disabled = true;
            timeSelect.appendChild(option);
            return;
        }

        allTimes.forEach((time) => {
            const option = document.createElement("option");
            option.value = time;

            const slotStart = parseTimeStr(time);
            const slotEnd = slotStart + totalDurationMinutes;

            let temConflito = false;

            for (let interval of occupiedIntervals) {
                if (slotStart < interval.end && slotEnd > interval.start) {
                    temConflito = true;
                    break;
                }
            }

            const emergencial = isHorarioEmergencial(time);

            if (temConflito) {
                option.textContent = emergencial
                    ? `${time} 🚨 Corte Emergencial - (Indisponível)`
                    : `${time} - (Indisponível)`;
                option.disabled = true;
            } else {
                option.textContent = emergencial
                    ? `${time} 🚨 Corte Emergencial (R$ ${precoEmergencialCalculado},00)`
                    : time;
            }

            timeSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Erro ao buscar disponibilidade:", err);
        if (minhaRequisicao === requisicaoHorariosAtual) {
            timeSelect.innerHTML = "";
            const optionErro = document.createElement("option");
            optionErro.value = "";
            optionErro.textContent = "Erro ao carregar horários. Verifique sua internet e tente novamente.";
            optionErro.disabled = true;
            timeSelect.appendChild(optionErro);
        }
    }
}

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
                const comNome = registrosCliente.find(item => item.cliente);
                if (comNome && comNome.cliente) {
                    document.getElementById("client-name").value = comNome.cliente;
                }

                const comNascimento = registrosCliente.find(item => item.nascimento);

                if (comNascimento && comNascimento.nascimento) {
                    document.getElementById("client-nascimento").value = comNascimento.nascimento;
                    if (groupNasc) groupNasc.style.display = "none";
                } else {
                    if (groupNasc) groupNasc.style.display = "block";
                }
            } else {
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

function abrirModalConfirmacao() {
    const nameInput = document.getElementById("client-name");
    const phoneInput = document.getElementById("client-phone");
    const dateInput = document.getElementById("date");
    const timeSelect = document.getElementById("time");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";

    if (!name || !phone) {
        alert("Por favor, digite o seu nome e WhatsApp antes de prosseguir.");
        return;
    }

    const telefoneDigitos = phone.replace(/\D/g, '');
    if (telefoneDigitos.length < 10 || telefoneDigitos.length > 11) {
        alert("Por favor, digite um WhatsApp válido, com DDD (ex: 31 99999-9999).");
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

    let precoTotal = 0;
    let temSobrancelha = false;
    
    const servicosNomes = selectedServices.map(s => {
        if (s.name.toLowerCase() === "sobrancelha") {
            temSobrancelha = true;
        }
        return s.name;
    });

    const emergencial = isHorarioEmergencial(time);
    
    // Regra Emergencial com Sobrancelha (+R$ 20)
    if (emergencial) {
        precoTotal = VALOR_CORTE_EMERGENCIAL;
        if (temSobrancelha) {
            precoTotal += 20;
        }
    } else {
        precoTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
    }

    const formattedDate = date.split("-").reverse().join("/");

    const resumoDiv = document.getElementById("resumo-agendamento");
    if (resumoDiv) {
        resumoDiv.innerHTML = `
            <div style="margin-bottom: 8px;"><strong>Barbeiro:</strong> ${selectedBarber}</div>
            <div style="margin-bottom: 8px;"><strong>Data:</strong> ${formattedDate} às ${time}</div>
            <div style="margin-bottom: 8px;"><strong>Serviços:</strong> ${servicosNomes.join(", ")}${emergencial ? " 🚨 (Horário Emergencial)" : ""}</div>
            <div style="margin-top: 12px; border-top: 1px solid #EAEAEA; padding-top: 8px; font-size: 1.1rem;">
                <strong>Total Estimado:</strong> <span style="color: #25D366; font-weight: bold;">R$ ${precoTotal.toFixed(2).replace('.', ',')}</span>
            </div>
        `;
    }

    const modal = document.getElementById("modal-confirmacao");
    if (modal) {
        modal.style.display = "flex";
    }
}

function fecharModalConfirmacao() {
    const modal = document.getElementById("modal-confirmacao");
    if (modal) {
        modal.style.display = "none";
    }
}

async function confirmarEEnviar() {
    fecharModalConfirmacao();
    await sendToWhatsapp();
}

async function sendToWhatsapp() {
    const nameInput = document.getElementById("client-name");
    const phoneInput = document.getElementById("client-phone");
    const nascimentoInput = document.getElementById("client-nascimento");
    const dateInput = document.getElementById("date");
    const timeSelect = document.getElementById("time");
    const btnAgendar = document.getElementById("btn-continuar") || document.getElementById("btn-agendar");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const nascimento = nascimentoInput ? nascimentoInput.value : null; 
    const date = dateInput ? dateInput.value : "";
    const time = timeSelect ? timeSelect.value : "";

    if (btnAgendar) {
        btnAgendar.disabled = true;
        btnAgendar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A agendar...';
    }

    let precoTotal = 0;
    let duracaoTotal = 0;
    let temSobrancelha = false;
    
    let arrayNomesServicos = selectedServices.map(s => {
        duracaoTotal += s.duration;
        if (s.name.toLowerCase() === "sobrancelha") {
            temSobrancelha = true;
        }
        return s.name;
    });

    const emergencial = isHorarioEmergencial(time);
    
    // Regra Emergencial com Sobrancelha (+R$ 20)
    if (emergencial) {
        precoTotal = VALOR_CORTE_EMERGENCIAL;
        if (temSobrancelha) {
            precoTotal += 20;
        }
    } else {
        precoTotal = selectedServices.reduce((acc, s) => acc + s.price, 0);
    }
    
    let listaNomesServicos = arrayNomesServicos.join(", ");

    const [hora, minuto] = time.split(":").map(Number);
    const dataFim = new Date(0, 0, 0, hora, minuto + duracaoTotal);
    const horarioFim = `${String(dataFim.getHours()).padStart(2, "0")}:${String(dataFim.getMinutes()).padStart(2, "0")}`;

    const formattedDate = date.split("-").reverse().join("/");
    const whatsappNumber = "5531975552202";

    const avisoEmergencial = emergencial ? `🚨 *HORÁRIO EMERGENCIAL (fora do expediente normal)* 🚨\n\n` : "";
    const message = `${avisoEmergencial}✅ *AGENDAMENTO CONFIRMADO!* ✅\n\nOlá! Segue a confirmação do meu horário:\n\n👤 *Cliente:* ${name}\n📱 *Telefone:* ${phone}\n💈 *Barbeiro:* ${selectedBarber}\n✂️ *Serviços:* ${listaNomesServicos}${emergencial ? " (Corte Emergencial)" : ""} (Total: R$ ${precoTotal},00)\n📅 *Data:* ${formattedDate}\n⏰ *Horário:* ${time} às ${horarioFim}`;

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
                    preco_total: precoTotal, // Agora armazena R$ 70,00 no banco se for com sobrancelha
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
        btnAgendar.innerHTML = 'Continuar Agendamento <i class="fa-solid fa-arrow-right" style="margin-left: 8px;"></i>';
    }

    window.location.href = link;
}
