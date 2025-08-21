import 'dotenv/config';
import axios from 'axios';

const moduleUuid = "c667ff46-9730-425e-ad48-1e950691b3f9";
const pointUuid = "71ef9476-3855-4a3f-8fc5-333cfbf9e898";

axios.get(
  `${process.env.CLOUD_OCEAN_BASE_URL}/v1/modules/${moduleUuid}/measuring-points/${pointUuid}/cdr`,
  { headers: { Authorization: `Bearer ${process.env.API_Key}` } }
)
.then(res => console.log(res.data))
.catch(err => console.error(err.response?.status, err.response?.data));
