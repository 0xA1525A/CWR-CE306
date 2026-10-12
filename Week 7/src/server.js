const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String },
  category: { type: String, required: true },
  stock: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true
});

const Product = mongoose.model('Product', ProductSchema);

// ข้อ 2: ค้นหาสินค้าด้วย keyword ใน name (case-insensitive)
// GET /products/search/:keyword
app.get('/products/search/:keyword', async (req, res) => {
  try {
    const { keyword } = req.params;
    const products = await Product.find({
      name: { $regex: keyword, $options: 'i' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ข้อ 3: กรองตามหมวดหมู่ (category)
// GET /products/category/:category
app.get('/products/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const products = await Product.find({ category: category });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ข้อ 4: แสดงเฉพาะสินค้าที่มี stock > 0
// GET /products/available
app.get('/products/available', async (req, res) => {
  try {
    const products = await Product.find({
      stock: { $gt: 0 }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/products/:id/add-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    // ตรวจสอบเงื่อนไข amount: ถ้า amount <= 0 หรือไม่ใช่ตัวเลข ให้ตอบ 400 Bad Request
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        message: 'Invalid amount. Amount must be a positive number greater than 0.'
      });
    }

    // เพิ่ม stock ด้วย $inc operator
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $inc: { stock: amount } },
      { new: true, runValidators: true }
    );

    // ถ้าไม่พบสินค้า ให้ตอบ 404 Not Found
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Stock updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// สร้างสินค้าใหม่
// POST /products
app.post('/products', async (req, res) => {
  try {
    const product = new Product(req.body);
    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// แสดงสินค้าทั้งหมด
// GET /products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// แสดงสินค้าตาม ID
// GET /products/:id
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// อัปเดตข้อมูลสินค้า
// PATCH /products/:id
app.patch('/products/:id', async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ข้อ 6: ลบสินค้าแบบปลอดภัย (ตรวจสอบการมีอยู่ก่อน)
// DELETE /products/:id
app.delete('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:2701/product_db';

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
  });
