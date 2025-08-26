import  fetch from 'node-fetch';
import {updateInvoiceEntry} from './update-invoice-entry.js';
export async function handler(event, context) {
  const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
  const measuringPointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";
  const start = "2024-10-16";
  const end = "2024-11-25";
  const url = `https://api.develop.rve.ca/v1/modules/${moduleUuid}/measuring-points/${measuringPointUuid}/reads?start=${start}&end=${end}`;

  try {
    const response = await fetch(url, {
      headers: { "Access-Token": 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI0IiwianRpIjoiODQ2YTk2NjFiMmFkM2E5YTY3N2FhYWQyNTgxMmIxODc0YzVhYjQ4M2UzNGNhYWQ1MjFmZmQ1MDBhMWNjZjFlOWM4ZTIyYzdhOTdlODA4OTgiLCJpYXQiOjE3MjIyNjU1MTcuMDk5NjE0LCJuYmYiOjE3MjIyNjU1MTcuMDk5NjIsImV4cCI6NDg3NzkzOTExNy4wOTI2NSwic3ViIjoiMTc3Iiwic2NvcGVzIjpbXX0.noGdf_SEdLRfnAI22kRRmysCnuCqEc9i1I2GTCvZ3WCxYqtNjaVr-oZ0nIxfhsSGwcdGpz7wnEfuY7YkwLW4Dm-I5CXVh6QhM652IWY8LVE9vwAJmHhS1kR-an5loQ3zaZ5s44eUR6uxW4aAUL4V7iXFiLxEvSDN_8HhvHOmPeD-sqg8ShFnWN6bSIQkKduC-87dKTmWLgd79usAo3r6qm_YYZurvpVuUHuK0Ll59oInH2GRBvIaHwK5-hwdAbsXKU_sNCA8A4cUckq6CPSDXVhvHaBDi-PSrBowP4yaz5pq_vZOqxzsuKfPzUEB5Z9w4bbS13hqQNVuZD2ixb0qb1yqbQ7ecWoXv4HJi2Yh03YTL9oagWfzLzY97H-t0TL8NKT3CE9fpc2ePxMQXU2lfCnS5t6kpk543TYwHWKL-kvY2p4ICq6vdxfRpakWj9XVQyMbDRA_KhBTw-ornuOVf5v4qWp-VMutqzhmWNwmul1ldng6tmvSJaLgKdbGJkNHYJUFm8XhEMvBhnoCj1khrhwD6DwPAXB1RyWREjiS-uCat8OnOJibV6rI4YqMTEi6mjtJUYNCRfKOqPO7bXPuVoiY6uZe77H7i_ooEPAKYMNFn-2V8O4LevPsLBW5vN0PPkXeGFaC_iFmdm2vROUaK3kd24o-YxtwPpFKiavqFrA' }
    });
    const data = await response.json();
    const totalKwh = data.data ? data.data.reduce((sum, read) => sum + parseFloat(read.consumption || 0), 0) : 0;
    const cost = totalKwh * 0.12;

    // Write to Contentful
    await updateInvoiceEntry({
      spaceId: 't3t3mhakehxg',
      environmentId: 'master' || 'master',
      entryId: 'invoice',
      invoiceData: { totalKwh, cost }
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ totalKwh, cost, raw: data }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
