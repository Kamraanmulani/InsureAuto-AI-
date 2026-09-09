const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const config = require('../config/env');

const forwardToML = async (filePath, originalName, isVideo, payload) => {
  const mlApiBase = config.mlApiUrl;
  const endpoint = isVideo
    ? `${mlApiBase}/api/analyze-claim-video`
    : `${mlApiBase}/api/analyze-claim`;

  const formData = new FormData();
  const fileFieldName = isVideo ? 'video' : 'image';
  formData.append(fileFieldName, fs.createReadStream(filePath), originalName);
  formData.append('claim_date', payload.claim_date);
  formData.append('claim_description', payload.claim_description);
  formData.append('claim_location', payload.claim_location || 'Unknown');
  formData.append('policy_id', payload.policy_id || '');

  const response = await axios.post(endpoint, formData, {
    headers: formData.getHeaders(),
    timeout: 240000
  });

  return response.data;
};

module.exports = { forwardToML };
