import dotenv from 'dotenv';
dotenv.config;
import pkg from 'contentful-management';
const { createClient } = pkg;
import fetch from 'node-fetch';

// Initialize Contentful client
const client = createClient({
  accessToken: process.env.CONTENTFUL_MANAGEMENT_TOKEN
});

// Helper function to create RichText content
function createRichTextContent(text) {
  return {
    nodeType: "document",
    data: {},
    content: [
      {
        nodeType: "paragraph",
        data: {},
        content: [
          {
            nodeType: "text",
            value: text,
            marks: [],
            data: {}
          }
        ]
      }
    ]
  };
}

// Mock function to simulate RVE API data fetching
async function fetchRVEData() {
  console.log('[INFO] Fetching consumption data from RVE API...');
  
  const stations = [
    { id: '01', name: 'EV Charger Station 01 (Building A - Level 1)', consumption: 31.84 },
    { id: '02', name: 'EV Charger Station 02 (Building A - Level 2)', consumption: 29.63 },
    { id: '03', name: 'EV Charger Station 03 (Building B - Parking Garage)', consumption: 0.24 },
    { id: '04', name: 'EV Charger Station 04 (Building B - Ground Floor)', consumption: 5.12 },
    { id: '05', name: 'EV Charger Station 05 (Building C - East Wing)', consumption: 26.61 },
    { id: '06', name: 'EV Charger Station 06 (Building C - West Wing)', consumption: 0.30 },
    { id: '07', name: 'EV Charger Station 07 (Building D - Main Entrance)', consumption: 28.79 },
    { id: '08', name: 'EV Charger Station 08 (Building D - Loading Dock)', consumption: 0.29 },
    { id: '09', name: 'EV Charger Station 09 (Outdoor Lot - Section A)', consumption: 0.05 },
    { id: '10', name: 'EV Charger Station 10 (Outdoor Lot - Section B)', consumption: 5.79 },
    { id: '11', name: 'EV Charger Station 11 (Visitor Parking - Main Gate)', consumption: 0.29 }
  ];

  const stationData = [];
  
  for (const station of stations) {
    console.log(`[INFO] Fetching data for ${station.name}`);
    console.log(`[INFO] ${station.name}: ${station.consumption} kWh`);
    stationData.push(station);
  }
  
  console.log(`[INFO] Fetched data for ${stationData.length}/${stations.length} stations`);
  return stationData;
}

// Function to create line items from station data
function createLineItems(stationData) {
  const unitPrice = 0.15;
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const billingStart = '2024-10-16T00:00:00.000Z';
  const billingEnd = '2024-11-25T23:59:59.000Z';
  
  return stationData.map(station => {
    const amount = (station.consumption * unitPrice).toFixed(2);
    
    // FIXED: Remove the extra "fields" wrapper
    return {
      date: { "en-US": currentDate },
      startTime: { "en-US": billingStart },
      endTime: { "en-US": billingEnd },
      energyConsumed: { "en-US": station.consumption.toString() },
      unitPrice: { "en-US": unitPrice.toString() },
      amount: { "en-US": amount }
    };
  });
}

// Main function to update Contentful
async function updateContentfulInvoice() {
  try {
    // Fetch data from RVE API
    const stationData = await fetchRVEData();
    
    console.log('[INFO] Writing invoice to Contentful...');
    console.log('[INFO] Updating invoice FAC-2024-001');
    
    // Get space and environment
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment('master');
    
    // Create line items
    const lineItems = createLineItems(stationData);
    
    // FIXED: Prepare the correct payload structure
    const invoiceData = {
      metadata: {
        tags: [],
        concepts: []
      },
      fields: {
        syndicateName: { "en-US": "RVE Cloud Ocean" },
        slug: { "en-US": "/fac-2024-001" },
        address: { "en-US": "123 EV Way, Montreal, QC" },
        contact: { "en-US": "contact@rve.ca" },
        invoiceNumber: { "en-US": "FAC-2024-001" },
        invoiceDate: { "en-US": "2025-09-15" },
        clientName: { "en-US": "John Doe" },
        clientEmail: { "en-US": "john.doe@example.com" },
        chargerSerialNumber: { "en-US": "CHG-001" },
        billingPeriodStart: { "en-US": "2024-10-16" },
        billingPeriodEnd: { "en-US": "2024-11-25" },
        
        // FIXED: Use RichText format for environmentalImpactText
        environmentalImpactText: { 
          "en-US": createRichTextContent("CO2 emissions reduced thanks to EV usage.")
        },
        
        paymentDueDate: { "en-US": "2025-10-15" },
        lateFeeRate: { "en-US": 0 },
        
        // FIXED: Line items without extra "fields" wrapper
        lineItems: { "en-US": lineItems }
      }
    };
    
    // Get the existing entry
    const entry = await environment.getEntry('FAC-2024-001');
    
    // Update the entry fields
    Object.keys(invoiceData.fields).forEach(fieldName => {
      entry.fields[fieldName] = invoiceData.fields[fieldName];
    });
    
    // Update the entry
    const updatedEntry = await entry.update();
    
    // Publish the entry
    await updatedEntry.publish();
    
    console.log('[SUCCESS] Invoice updated and published successfully!');
    
    // Calculate totals for summary
    const totalEnergy = stationData.reduce((sum, station) => sum + station.consumption, 0);
    const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.amount["en-US"]), 0);
    
    console.log(`[SUMMARY] Total energy consumed: ${totalEnergy.toFixed(2)} kWh`);
    console.log(`[SUMMARY] Total amount: $${totalAmount.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ Error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

// Alternative function if you need to create a new entry instead of updating
async function createNewContentfulInvoice() {
  try {
    const stationData = await fetchRVEData();
    
    console.log('[INFO] Creating new invoice in Contentful...');
    
    const space = await client.getSpace(process.env.CONTENTFUL_SPACE_ID);
    const environment = await space.getEnvironment('master');
    
    const lineItems = createLineItems(stationData);
    
    const invoiceData = {
      fields: {
        syndicateName: { "en-US": "RVE Cloud Ocean" },
        slug: { "en-US": "/FAC-2024-001" },
        address: { "en-US": "123 EV Way, Montreal, QC" },
        contact: { "en-US": "contact@rve.ca" },
        invoiceNumber: { "en-US": "FAC-2024-001" },
        invoiceDate: { "en-US": "2025-09-15" },
        clientName: { "en-US": "John Doe" },
        clientEmail: { "en-US": "john.doe@example.com" },
        chargerSerialNumber: { "en-US": "CHG-001" },
        billingPeriodStart: { "en-US": "2024-10-16" },
        billingPeriodEnd: { "en-US": "2024-11-25" },
        environmentalImpactText: { 
          "en-US": createRichTextContent("CO2 emissions reduced thanks to EV usage.")
        },
        paymentDueDate: { "en-US": "2025-10-15" },
        lateFeeRate: { "en-US": 0 },
        lineItems: { "en-US": lineItems }
      }
    };
    
    // Create new entry (replace 'invoice' with your actual content type ID)
    const entry = await environment.createEntry('invoice', invoiceData);
    const publishedEntry = await entry.publish();
    
    console.log('[SUCCESS] New invoice created and published successfully!');
    console.log(`[INFO] Entry ID: ${publishedEntry.sys.id}`);
    
  } catch (error) {
    console.error('❌ Error creating new entry:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  updateContentfulInvoice();
  
  // Uncomment the line below if you want to create a new entry instead
  // createNewContentfulInvoice();
}

module.exports = {
  updateContentfulInvoice,
  createNewContentfulInvoice,
  createRichTextContent,
  createLineItems
};