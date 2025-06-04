import React, { useEffect, useState } from 'react';
import {
  Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField,
  MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Typography, Box, Select, InputLabel, FormControl, IconButton
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import JsBarcode from 'jsbarcode';
import CloseIcon from '@mui/icons-material/Close';
import Swal from 'sweetalert2';
import Barcode from 'react-barcode';

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [barcodeImage, setBarcodeImage] = useState(null);
  const [barcodePopupOpen, setBarcodePopupOpen] = useState(false);
  const [currentBarcode, setCurrentBarcode] = useState('');

  const [formData, setFormData] = useState({
    order_number: `ORD-${Date.now()}`,
    recipe_id: '',
    batch_size: '',
    scheduled_date: '',
    status: 'planned',
    notes: '',
    barcode_id: ''
  });

  useEffect(() => {
    fetchOrders();
    fetchRecipes();
  }, []);

  const getAuthConfig = () => {
    const token = localStorage.getItem("access_token");
    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/production_orders', getAuthConfig());
      const ordersData = Array.isArray(res.data) ? res.data : [];
      const ordersWithStatus = await Promise.all(
        ordersData.map(async (order) => {
          try {
            const recipeRes = await axios.get(
              `http://127.0.0.1:5000/api/recipe_materials/${order.recipe_id}`,
              getAuthConfig()
            );
            const materials = Array.isArray(recipeRes.data)
              ? recipeRes.data
              : recipeRes.data.materials;
            let finalStatus = "Dosed"; // Default if all are dosed
            if (materials && materials.length > 0) {
              for (let item of materials) {
                if (item.status === "pending" || item.status === "Rejected") {
                  finalStatus = "Pending";
                  break;
                }
                if (item.status !== "dosed") {
                  finalStatus = "In Progress"; // Optional fallback
                }
              }
            } else {
              finalStatus = "No Materials";
            }
            return { ...order, recipe_status: finalStatus };
          } catch (err) {
            console.error(`Failed to fetch recipe_material for recipe_id ${order.recipe_id}`, err);
            return { ...order, status: 'Error' };
          }
        })
      );
      setOrders(ordersWithStatus);
    } catch (err) {
      alert(`Error fetching orders: ${err}`);
    }
  };

  const fetchRecipes = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/recipes?page=1&per_page=1000', getAuthConfig());

      const recipesArray = Array.isArray(res.data.data)
        ? res.data.data
        : Array.isArray(res.data.recipes)
          ? res.data.recipes
          : [];

      setRecipes(recipesArray);
    } catch (err) {
      alert(`Error fetching recipes: ${err}`);
    }
  };

  const openDialog = () => {
    setEditingOrder(null);
    setFormData({
      order_number: `ORD-${Date.now()}`,
      recipe_id: '',
      batch_size: '',
      scheduled_date: '',
      status: 'planned',
      notes: '',
      barcode_id: ''
    });
    setDialogOpen(true);
    setBarcodeImage(null);
  };

  const closeDialog = () => setDialogOpen(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDelete = async (orderId) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, delete it!",
      customClass: {
        popup: "relative",
      },
      didOpen: () => {
        const swal = Swal.getPopup();

        // Create the close icon
        const closeBtn = document.createElement("button");
        closeBtn.innerHTML = "&times;";
        closeBtn.style.position = "absolute";
        closeBtn.style.top = "10px";
        closeBtn.style.right = "10px";
        closeBtn.style.background = "#fff";
        closeBtn.style.color = "#f44336";
        closeBtn.style.border = "2px solid #f44336";
        closeBtn.style.borderRadius = "50%";
        closeBtn.style.width = "30px";
        closeBtn.style.height = "30px";
        closeBtn.style.cursor = "pointer";
        closeBtn.style.fontSize = "18px";
        closeBtn.style.lineHeight = "0";
        closeBtn.style.display = "flex";
        closeBtn.style.justifyContent = "center";
        closeBtn.style.alignItems = "center";

        // Close on click
        closeBtn.onclick = () => {
          Swal.close();
        };

        swal.appendChild(closeBtn);
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(
            `http://127.0.0.1:5000/api/production_orders/${orderId}`,
            getAuthConfig()
          );
          await fetchOrders();
          Swal.fire("Deleted!", "The order has been deleted.", "success");
        } catch (error) {
          alert(`Delete error: ${error}`);
          const errorMessage = error.response?.data?.error || 'An unknown error occurred';
          Swal.fire("Error!", `Failed to delete the order: ${errorMessage}`, "error");
        }
      }
    });
  };

  const handlePrint = (order) => {
    const recipeName = recipes.find(r => r.recipe_id === order.recipe_id)?.name || 'Unknown';
    const printWindow = window.open('', '_blank');
    const content = `
      <html>
        <head>
          <title>Print Order</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { margin-top: 0; }
            .label { font-weight: bold; }
            .barcode-container { margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2>Production Order Details</h2>
          <p><span class="label">Order ID:</span> ${order.order_number}</p>
          <p><span class="label">Recipe:</span> ${recipeName}</p>
          <p><span class="label">Batch Size:</span> ${order.batch_size}</p>
          <p><span class="label">Dosing:</span> ${order.dosing ? order.dosing.toFixed(2) : '—'}</p>
          <div class="barcode-container">
            <svg id="barcode"></svg>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <script>
            JsBarcode("#barcode", "${order.barcode_id}", {
              format: "CODE128",
              width: 2,
              height: 60,
              displayValue: true
            });
            window.onload = function () {
              setTimeout(() => window.print(), 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const handleSubmit = async () => {
    try {
      if (editingOrder) {
        await axios.put(`http://127.0.0.1:5000/api/production_orders/${editingOrder.order_id}`, formData, getAuthConfig());
        Swal.fire({
          title: 'Success!',
          text: 'Order updated successfully',
          icon: 'success',
          confirmButtonText: 'OK',
          customClass: {
            confirmButton: 'my-confirm-button-class'
          },
        });
      } else {
        await axios.post('http://127.0.0.1:5000/api/production_orders', formData, getAuthConfig());
        Swal.fire({
          title: 'Success!',
          text: 'Order created successfully',
          icon: 'success',
          confirmButtonText: 'OK',
          customClass: {
            popup: 'custom-popup',
            confirmButton: 'custom-confirm-button'
          },
        });
      }
      await fetchOrders();
      closeDialog();
    } catch (error) {
      alert(`Error saving order: ${error}`);
      alert('Failed to save order.');
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      order_number: order.order_number,
      recipe_id: order.recipe_id,
      batch_size: order.batch_size,
      scheduled_date: order.scheduled_date,
      status: order.status,
      notes: order.notes,
      barcode_id: order.barcode_id || ''
    });
    setDialogOpen(true);
    generateBarcodePreview(order.barcode_id || '');
  };

  const generateBarcodePreview = (barcodeId) => {
    if (!barcodeId || typeof barcodeId !== 'string' || barcodeId.trim() === '') {
      setBarcodeImage(null); // Clear preview
      return;
    }

    const canvas = document.createElement('canvas');
    try {
      JsBarcode(canvas, barcodeId, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
      });
      setBarcodeImage(canvas.toDataURL());
    } catch (error) {
      alert(`Error generating barcode: ${error}`);
    }
  };

  const generateBarcodeId = () => {
    const barcodeId = (Math.floor(Math.random() * 9000000000000) + 1000000000000).toString();
    setFormData(prev => ({ ...prev, barcode_id: barcodeId }));
    generateBarcodePreview(barcodeId);
  };

  const openBarcodePopup = (barcodeId) => {
    setCurrentBarcode(barcodeId);
    setBarcodePopupOpen(true);
  };

  const closeBarcodePopup = () => {
    setBarcodePopupOpen(false);
  };

  const statusStyle = {
    completed: { background: '#D1FAE5', color: '#065F46' },
    in_progress: { background: '#DBEAFE', color: '#1E3A8A' },
    planned: { background: '#F3F4F6', color: '#374151' },
    failed: { background: '#FECACA', color: '#991B1B' }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4">Production Orders</Typography>
        <Box display="flex" gap={2}>
          <Button variant="contained" onClick={openDialog}>Create Order</Button>
          <Button variant="contained" style={{ backgroundColor: '#16a34a' }} onClick={() => navigate("/material-transactions")}>
            ➕ Add Material Transaction
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: '#f5f5f5' }}>
            <TableRow>
              <TableCell>Order #</TableCell>
              <TableCell>Recipe</TableCell>
              <TableCell>Batch Size</TableCell>
              <TableCell>Scheduled Date</TableCell>
              <TableCell>Created By</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Barcode</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell>Dosing (kg)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map(order => (
              <TableRow key={order.order_id}>
                <TableCell>{order.order_number}</TableCell>
                <TableCell>{recipes.find(r => r.recipe_id === order.recipe_id)?.name || 'Unknown'}</TableCell>
                <TableCell>{order.batch_size}</TableCell>
                <TableCell>{new Date(order.scheduled_date).toLocaleDateString()}</TableCell>
                <TableCell>{order.created_by_username || 'Unknown'}</TableCell>
                <TableCell>
                  <span style={{ ...statusStyle[order.status], padding: '4px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                    {order.status.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell><Barcode value={order.barcode_id} height={40} /></TableCell>
                <TableCell>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      gap: '0.5rem',
                      flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                    }}
                  >
                   <Button 
                          size="small" 
                          color="primary" 
                          onClick={async () => {
                            try {
                              const response = await fetch('api/start-scanner', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                              });

                              const result = await response.json();
                              console.log(result.message); // "Scanner started" or "Scanner already running"
                            } catch (error) {
                              console.error('Error starting scanner:', error);
                            }

                            openBarcodePopup(order.barcode_id); // Open scanner UI/popup
                          }}
                        >
                          Start Scan
                  </Button>
                    <Button size="small" onClick={() => navigate(`/orders/${order.order_id}`)}>View</Button>
                    <Button size="small" color="warning" onClick={() => handleEdit(order)}>Edit</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(order.order_id)}>Delete</Button>
                    <Button size="small" color="secondary" onClick={() => handlePrint(order)}>Print</Button>
                  </div>
                </TableCell>
                <TableCell>{order.dosing ? order.dosing.toFixed(2) : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Order Form Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <Box position="relative">
          <DialogTitle>{editingOrder ? 'Edit Production Order' : 'Create Production Order'}</DialogTitle>
          <IconButton onClick={closeDialog} sx={{ position: 'absolute', top: 8, right: 8, border: '1px solid red', borderRadius: '50%', padding: '6px', height: '40px', width: '40px' }}>
            <CloseIcon sx={{ color: 'red' }} />
          </IconButton>
        </Box>
        <DialogContent>
          <Box display="grid" gridTemplateColumns={{ md: '1fr 1fr' }} gap={2} mt={1}>
            <TextField label="Order Number" fullWidth value={formData.order_number} disabled />
            <FormControl fullWidth>
              <InputLabel>Recipe</InputLabel>
              <Select name="recipe_id" value={formData.recipe_id} label="Recipe" onChange={handleChange}>
                {recipes.map(recipe => (
                  <MenuItem key={recipe.recipe_id} value={recipe.recipe_id}>{recipe.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField name="batch_size" label="Batch Size" value={formData.batch_size} onChange={handleChange} fullWidth />
            <TextField type="date" name="scheduled_date" label="Scheduled Date" InputLabelProps={{ shrink: true }} value={formData.scheduled_date} onChange={handleChange} fullWidth />
            <TextField name="notes" label="Notes" value={formData.notes} onChange={handleChange} fullWidth />
            <TextField label="Barcode ID" value={formData.barcode_id} fullWidth disabled />
            {barcodeImage && <img src={barcodeImage} alt="Barcode Preview" style={{ height: 80 }} />}
            <Button onClick={generateBarcodeId} variant="outlined" color="primary">Generate Barcode</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">{editingOrder ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      {/* Barcode Popup Dialog */}
      <Dialog open={barcodePopupOpen} onClose={closeBarcodePopup} maxWidth="sm" fullWidth>
        <DialogTitle>Scan Barcode</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
          <Typography variant="h6" gutterBottom>Please scan the barcode below:</Typography>
          {currentBarcode && (
            <Box sx={{ margin: '20px 0', padding: '20px', border: '1px solid #eee', borderRadius: '4px' }}>
              <Barcode value={currentBarcode} height={100} width={3} fontSize={20} />
            </Box>
          )}
          <Typography variant="body1" sx={{ marginTop: '10px' }}>
            Barcode ID: {currentBarcode}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBarcodePopup} color="primary">Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Orders;