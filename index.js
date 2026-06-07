const app = require('./src/api');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running locally at http://localhost:${PORT}`);
});
