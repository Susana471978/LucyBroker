export const mockUser = {
  id: "demo-001",
  name: "Carmen Rodríguez",
  email: "carmen@objjetiva.es",
  language: "es",
  plan: "profesional"
};

export const mockEmails = [
  {
    email: {
      id: "e001",
      subject: "URGENTE: Siniestro vehículo - Póliza 4821-VH",
      from_name: "Antonio Méndez",
      from_email: "a.mendez@gmail.com",
      date: new Date().toISOString(),
      snippet: "Buenos días, ayer tuve un accidente en la A-7. Necesito que me indiquen los pasos a seguir urgentemente.",
      has_attachments: true
    },
    priority: { priority_label: "PRIORITARIO", priority_score: 98 }
  },
  {
    email: {
      id: "e002",
      subject: "Renovación póliza hogar vence en 5 días - Ref. 2291-HG",
      from_name: "Isabel Fuentes",
      from_email: "ifuentes@hotmail.com",
      date: new Date(Date.now() - 86400000).toISOString(),
      snippet: "Quería confirmar si mi póliza de hogar se renueva automáticamente o tengo que hacer algo.",
      has_attachments: false
    },
    priority: { priority_label: "PRIORITARIO", priority_score: 91 }
  },
  {
    email: {
      id: "e003",
      subject: "Recibo impagado - Seguro de vida Ref. 1109-SV",
      from_name: "Mapfre Seguros",
      from_email: "notificaciones@mapfre.es",
      date: new Date(Date.now() - 172800000).toISOString(),
      snippet: "Le informamos que el recibo correspondiente al mes de mayo no ha podido ser procesado.",
      has_attachments: true
    },
    priority: { priority_label: "PRIORITARIO", priority_score: 87 }
  },
  {
    email: {
      id: "e004",
      subject: "Solicitud ampliación cobertura - Póliza empresa",
      from_name: "Pedro Alonso",
      from_email: "pedro@constructorasol.es",
      date: new Date(Date.now() - 259200000).toISOString(),
      snippet: "Nos gustaría ampliar la cobertura de responsabilidad civil de nuestra póliza empresarial.",
      has_attachments: false
    },
    priority: { priority_label: "SEGUIMIENTO", priority_score: 72 }
  },
  {
    email: {
      id: "e005",
      subject: "Consulta sobre seguro de salud familiar",
      from_name: "Laura Jiménez",
      from_email: "laura.jimenez@gmail.com",
      date: new Date(Date.now() - 345600000).toISOString(),
      snippet: "Somos una familia de 4 personas y queremos contratar un seguro de salud.",
      has_attachments: false
    },
    priority: { priority_label: "SEGUIMIENTO", priority_score: 65 }
  },
  {
    email: {
      id: "e006",
      subject: "Confirmación pago prima anual - Ref. 3345-AU",
      from_name: "Allianz Seguros",
      from_email: "confirmacion@allianz.es",
      date: new Date(Date.now() - 432000000).toISOString(),
      snippet: "Confirmamos la recepción del pago de prima anual del seguro de automóvil.",
      has_attachments: false
    },
    priority: { priority_label: "INFORMATIVO", priority_score: 30 }
  }
];

export const mockStats = {
  total: 6,
  prioritarios: 3,
  seguimiento: 2,
  with_attachments: 2
};

export const mockAlerts = [
  { type: "vencimiento", text: "3 pólizas vencen esta semana", urgency: "high" },
  { type: "siniestro", text: "1 siniestro sin respuesta +24h", urgency: "high" },
  { type: "impago", text: "2 recibos impagados pendientes", urgency: "medium" }
];
