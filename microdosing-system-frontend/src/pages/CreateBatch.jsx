import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';

const CreateBatch = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('access_token');

  const [formData, setFormData] = useState({
    batch_number: '',
    order_id: '',
    operator_id: user?.user_id || '',
    status: 'released',
    notes: '',
  });

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` },
          params: {},
        };

        if (user?.role === 'operator') {
          config.params.operator_id = user.user_id;
        }

        const res = await axios.get('http://127.0.0.1:5000/api/production_orders', config);
        setOrders(res.data.orders || res.data);
      } catch (err) {
        console.error('Error fetching orders:', err);
        Swal.fire('Error', `Failed to load orders for ${user?.role}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role && token) fetchOrders();
  }, [user?.role, token]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post('http://127.0.0.1:5000/api/batches', formData, config);

      Swal.fire({
        title: '✅ Success!',
        text: response.data.message || 'Batch created successfully.',
        icon: 'success',
      }).then(() => navigate('/batches'));
    } catch (err) {
      console.error('Error creating batch:', err);
      const msg = err.response?.data?.error || 'Failed to create batch';
      Swal.fire('❌ Error', msg, 'error');
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading orders...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-black px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create New Batch</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Batch Number */}
          <div>
            <label className="block text-sm font-medium mb-1">Batch Number *</label>
            <input
              type="text"
              name="batch_number"
              value={formData.batch_number}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
              placeholder="e.g., BAT-2024-001"
            />
          </div>

          {/* Order ID */}
          <div>
            <label className="block text-sm font-medium mb-1">Order ID *</label>
            <select
              name="order_id"
              value={formData.order_id}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              required
            >
              <option value="">Select Order</option>
              {orders.map(order => (
                <option key={order.order_id} value={order.order_id}>
                  {order.order_number || order.order_id}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
            >
              <option value="unreleased">Unreleased</option>
              <option value="released">Released</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded"
              rows="4"
              placeholder="Any special instructions..."
            />
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Create Batch
            </button>
            <button
              type="button"
              onClick={() => navigate('/batches')}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBatch;
