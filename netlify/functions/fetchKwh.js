const fetch = require('node-fetch');

exports.handler = async (event) => {
  const qs = (event && event.queryStringParameters) || {};
  const moduleUuid = qs.moduleUuid || "c667ff46-9730-425e-ad48-1e950691b3f9";
  const measuringPointUuid = qs.measuringPointUuid || "71ef9476-3855-4a3f-8fc5-333cfbf9e898";
  const start = qs.start || "2024-10-16";
  const end = qs.end || "2024-11-25";

  const url = `https://api.develop.rve.ca/v1/modules/${encodeURIComponent(moduleUuid)}/measuring-points/${encodeURIComponent(measuringPointUuid)}/reads?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;

  try {
    const response = await fetch(url, {
      headers: { "Access-Token": process.env.API_Key },
    });

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: 'Upstream error', status: response.status }) };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
