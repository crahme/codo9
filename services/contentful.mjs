import contentful from 'contentful-management';

class ContentfulService {
  constructor(accessToken, spaceId, environmentId = 'master') {
    this.client = contentful.createClient({ accessToken });
    this.spaceId = spaceId;
    this.environmentId = environmentId;
  }

  async getEnvironment() {
    const space = await this.client.getSpace(this.spaceId);
    return space.getEnvironment(this.environmentId);
  }

  // Example: update entry
  async updateInvoiceEntry(entryId, invoiceData) {
    const env = await this.getEnvironment();
    const entry = await env.getEntry(entryId);
    Object.keys(invoiceData).forEach(key => {
      entry.fields[key] = { 'en-US': invoiceData[key] };
    });
    const updatedEntry = await entry.update();
    await updatedEntry.publish();
    return updatedEntry;
  }
}

export default ContentfulService;
