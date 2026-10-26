const app = require('./app');
app.listen(process.env.PORT || 3001, () => console.log(`Server running on http://localhost:${process.env.PORT}`));
