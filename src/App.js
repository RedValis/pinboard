import React, { useState, useRef, useEffect } from "react";

// Helper to generate unique IDs for notes and links
function uuid() {
  return Math.random().toString(36).slice(2) + Date.now();
}

const COLORS = ["#FFFAA0", "#BCF4DE", "#C5C3FF", "#FFD7D6", "#FFE9E8", "#DEEBFF"];

export default function App() {
  const [notes, setNotes] = useState([]);
  const [connections, setConnections] = useState([]); // {from, to}
  const [connecting, setConnecting] = useState(null);
  const connectingRef = useRef(null); // Ref to keep real-time connecting note ID
  const [connectLine, setConnectLine] = useState(null); // {fromPin:{x,y}, to:{x,y}}
  const [connectionJustFinished, setConnectionJustFinished] = useState(false);
  const [nearbyNote, setNearbyNote] = useState(null); // For highlighting nearby connection target
  const [hoveredConnection, setHoveredConnection] = useState(null); // For highlighting hovered connections
  const boardRef = useRef();

  // Ref to keep bounding rects for all notes
  const noteBoundsRef = useRef({});

  // Callback to set bounding rect for a note
  const handleNoteRef = (id, el) => {
    if (el) {
      noteBoundsRef.current[id] = el.getBoundingClientRect();
    } else {
      delete noteBoundsRef.current[id];
    }
  };

  // Add new note unless a connection just finished or is in progress
  const handleAddNote = (e) => {
    if (e.target !== boardRef.current) return;

    if (connecting || connectLine) return; // prevent adding while dragging connection

    if (connectionJustFinished) {
      setConnectionJustFinished(false); // consume event
      return;
    }

    // Check if we're coming from a resize operation
    if (e.target.closest('[data-resize-handle]')) {
      return; // Don't add note if click came from resize handle
    }

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setNotes([
      ...notes,
      {
        id: uuid(),
        x: x - 75,
        y: y - 30,
        text: "",
        width: 150,
        height: 80,
        images: [], // Changed to array for multiple images
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      },
    ]);
  };

  // Drag note by updating position
  const handleDrag = (id, dx, dy) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === id ? { ...n, x: n.x + dx, y: n.y + dy } : n
      )
    );
  };

  // Resize note by updating dimensions
  const handleResize = (id, newWidth, newHeight) => {
    setNotes((prevNotes) =>
      prevNotes.map((n) =>
        n.id === id ? { ...n, width: newWidth, height: newHeight } : n
      )
    );
  };

  // Check if mouse is near any note's connection circle
  const findNearbyNote = (mouseX, mouseY, excludeId) => {
    const PROXIMITY_THRESHOLD = 30; // pixels
    const boardRect = boardRef.current.getBoundingClientRect();
    
    // Convert mouse position to board coordinates
    const mouseBoardX = mouseX - boardRect.left;
    const mouseBoardY = mouseY - boardRect.top;
    
    for (const note of notes) {
      if (note.id === excludeId) continue;
      
      // Calculate circle center position using current note position
      const circleX = note.x + (note.width || 150) - 25; // Adjust for new circle position based on width
      const circleY = note.y + 15;  // Top area where circle is positioned
      
      const distance = Math.sqrt(
        Math.pow(mouseBoardX - circleX, 2) + Math.pow(mouseBoardY - circleY, 2)
      );
      
      console.log(`Checking note ${note.id}: mouse(${mouseBoardX}, ${mouseBoardY}) vs circle(${circleX}, ${circleY}) = distance ${distance}`);
      
      if (distance <= PROXIMITY_THRESHOLD) {
        console.log(`Found nearby note: ${note.id}`);
        return note.id;
      }
    }
    return null;
  };

  // Start connection drag from a circle on note
  const handleStartConnect = (note, circleDom, e) => {
    const boardRect = boardRef.current.getBoundingClientRect();
    const circleRect = circleDom.getBoundingClientRect();
    const start = {
      x: circleRect.left - boardRect.left + circleRect.width / 2,
      y: circleRect.top - boardRect.top + circleRect.height / 2,
    };
    setConnecting(note.id);
    connectingRef.current = note.id;
    setConnectLine({ fromPin: start, to: start });

    const onMove = (evt) => {
      const mouseX = evt.clientX;
      const mouseY = evt.clientY;
      
      setConnectLine((line) => ({
        ...line,
        to: { x: mouseX - boardRect.left, y: mouseY - boardRect.top },
      }));

      // Check for nearby notes
      const nearby = findNearbyNote(mouseX, mouseY, connectingRef.current);
      setNearbyNote(nearby);
    };

    const onUp = (evt) => {
      const fromId = connectingRef.current;
      
      // Mouse position in viewport
      const mouseX = evt.clientX;
      const mouseY = evt.clientY;

      // Check for nearby connection target
      const connectedNoteId = findNearbyNote(mouseX, mouseY, fromId);
      
      console.log('Connection attempt:', { fromId, connectedNoteId, mouseX, mouseY });

      if (connectedNoteId && fromId && fromId !== connectedNoteId) {
        // Avoid duplicates (either direction)
        const exists = connections.some(
          (c) =>
            (c.from === fromId && c.to === connectedNoteId) || 
            (c.from === connectedNoteId && c.to === fromId)
        );
        if (!exists) {
          const newConnection = { from: fromId, to: connectedNoteId, id: uuid() };
          setConnections(prev => [...prev, newConnection]);
          console.log('Connection created:', newConnection);
        } else {
          console.log('Connection already exists');
        }
      }

      // Clean up
      setConnectLine(null);
      setConnecting(null);
      setNearbyNote(null);
      connectingRef.current = null;
      setConnectionJustFinished(true);

      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Complete connection between circles
  const handleEndConnect = (id) => {
    const fromId = connectingRef.current;
    if (fromId && fromId !== id) {
      // Avoid duplicates (either direction)
      const exists = connections.some(
        (c) =>
          (c.from === fromId && c.to === id) || (c.from === id && c.to === fromId)
      );
      if (!exists) {
        const newConnection = { from: fromId, to: id, id: uuid() };
        setConnections([...connections, newConnection]);
      }
    }
  };

  // Delete a specific connection
  const handleDeleteConnection = (connectionId) => {
    setConnections(connections.filter((c) => c.id !== connectionId));
  };

  // Delete note and its related connections
  const handleDelete = (id) => {
    setNotes(notes.filter((n) => n.id !== id));
    setConnections(connections.filter((c) => c.from !== id && c.to !== id));
    // Also clean bounding rects for deleted notes
    delete noteBoundsRef.current[id];
  };

  // Render lines connecting notes with arrows
  const renderConnections = () =>
    connections.map((link) => {
      const from = notes.find((n) => n.id === link.from);
      const to = notes.find((n) => n.id === link.to);
      if (!from || !to) return null;
      const startX = from.x + (from.width || 150) - 25; // Adjust for circle position based on width
      const startY = from.y + 15;
      const endX = to.x + (to.width || 150) - 25;
      const endY = to.y + 15;
      
      const isHovered = hoveredConnection === link.id;
      
      return (
        <g key={link.id}>
          {/* Invisible thick line for easier mouse interaction */}
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke="transparent"
            strokeWidth={12}
            style={{ cursor: "pointer", pointerEvents: "all" }}
            onMouseEnter={() => setHoveredConnection(link.id)}
            onMouseLeave={() => setHoveredConnection(null)}
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteConnection(link.id);
            }}
          />
          {/* Visible line */}
          <line
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            stroke={isHovered ? "#ff6b35" : "#888"}
            strokeWidth={isHovered ? 3 : 2}
            markerEnd="url(#arrowhead)"
            style={{ pointerEvents: "none" }}
          />
        </g>
      );
    });

  // Export board state to JSON file
  const handleExport = () => {
    const boardState = {
      notes,
      connections,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    
    const dataStr = JSON.stringify(boardState, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `sticky-notes-board-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Import board state from JSON file
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const boardState = JSON.parse(e.target.result);
        
        // Validate the imported data structure
        if (boardState.notes && Array.isArray(boardState.notes) && 
            boardState.connections && Array.isArray(boardState.connections)) {
          setNotes(boardState.notes);
          setConnections(boardState.connections);
          
          // Clear any ongoing operations
          setConnecting(null);
          setConnectLine(null);
          setNearbyNote(null);
          setHoveredConnection(null);
          connectingRef.current = null;
          
          console.log('Board imported successfully');
        } else {
          alert('Invalid board file format. Please select a valid sticky notes board file.');
        }
      } catch (error) {
        console.error('Error importing board:', error);
        alert('Error reading board file. Please check the file format.');
      }
    };
    reader.readAsText(file);
    
    // Reset the file input so the same file can be imported again
    event.target.value = '';
  };

  return (
    <div>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        margin: "10px 20px" 
      }}>
        <div style={{ flex: 1 }} />
        <h2 style={{ margin: 0, textAlign: "center" }}>Sticky Notes Board 📝</h2>
        <div style={{ 
          flex: 1, 
          display: "flex", 
          justifyContent: "flex-end", 
          gap: "10px" 
        }}>
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: "none" }}
            id="import-file-input"
          />
          <button
            onClick={() => document.getElementById('import-file-input').click()}
            style={{
              padding: "8px 16px",
              background: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
            title="Import board from file"
          >
            📁 Import
          </button>
          <button
            onClick={handleExport}
            style={{
              padding: "8px 16px",
              background: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
            title="Export board to file"
          >
            💾 Export
          </button>
        </div>
      </div>
      <div
        ref={boardRef}
        onClick={handleAddNote}
        style={{
          position: "relative",
          width: "100vw",
          height: "90vh",
          background: "#f7f7f7",
          overflow: "hidden",
          border: "2px dashed #e2e2e2",
          userSelect: connecting ? "none" : "auto",
        }}
      >
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="4"
              refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8" fill={hoveredConnection ? "#ff6b35" : "#888"} />
            </marker>
          </defs>
          {renderConnections()}
        </svg>
        {connectLine && (
          <svg
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              overflow: "visible",
            }}
          >
            <line
              x1={connectLine.fromPin.x}
              y1={connectLine.fromPin.y}
              x2={connectLine.to.x}
              y2={connectLine.to.y}
              stroke="orange"
              strokeWidth={2}
              strokeDasharray="5,2"
            />
          </svg>
        )}
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            {...note}
            onDrag={handleDrag}
            onDelete={handleDelete}
            onTextChange={(val) =>
              setNotes(
                notes.map((n) => (n.id === note.id ? { ...n, text: val } : n))
              )
            }
            onImageAdd={(imageData) =>
              setNotes((prevNotes) =>
                prevNotes.map((n) => 
                  n.id === note.id 
                    ? { ...n, images: [...(n.images || []), imageData] } 
                    : n
                )
              )
            }
            onImageRemove={(imageIndex) =>
              setNotes((prevNotes) =>
                prevNotes.map((n) => 
                  n.id === note.id 
                    ? { ...n, images: (n.images || []).filter((_, i) => i !== imageIndex) } 
                    : n
                )
              )
            }
            onStartConnect={handleStartConnect}
            onResize={handleResize}
            setNoteRef={(el) => handleNoteRef(note.id, el)}
            isNearby={nearbyNote === note.id}
          />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 15, color: "#888" }}>
        Click anywhere to add a note; drag by the top bar, connect notes by dragging from the circle and getting close to another note's circle. Hover over connection lines to highlight them, click to delete. Drag the bottom-right corner to resize notes. Click 🟰 to attach images or paste images directly into the text area.
      </div>
    </div>
  );
}

function StickyNote({
  id,
  x,
  y,
  text,
  color,
  onDrag,
  onDelete,
  onTextChange,
  onImageAdd,
  onImageRemove,
  onStartConnect,
  setNoteRef,
  isNearby,
  width = 150,
  height = 80,
  images = [],
  onResize,
}) {
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const divRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (divRef.current) {
      setNoteRef(divRef.current);
    }
    return () => {
      setNoteRef(null);
    };
  }, [setNoteRef]);

  // Handle image file selection
  const handleImageUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const imageData = e.target.result;
          onImageAdd(imageData);
          
          // Auto-resize note to accommodate new image if needed
          const aspectRatio = img.width / img.height;
          const maxImageWidth = Math.max(width - 20, 200); // Account for padding
          const newImageHeight = maxImageWidth / aspectRatio;
          
          // Calculate total height needed for all images plus text
          const totalImagesHeight = (images.length + 1) * (newImageHeight + 6); // +6 for gap
          const newNoteHeight = Math.max(height, totalImagesHeight + 120); // Add space for text and header
          const newNoteWidth = Math.max(width, 200); // Minimum width for images
          
          onResize(id, newNoteWidth, newNoteHeight);
          setShowDropdown(false);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e) => {
      if (!textareaRef.current || document.activeElement !== textareaRef.current) {
        return;
      }
      
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (file) {
              handleImageUpload(file);
            }
            break;
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [images]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showDropdown && divRef.current && !divRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Mouse event handlers for dragging
  const onMouseDown = (e) => {
    if (resizing || showDropdown) return; // Don't start dragging while resizing or dropdown is open
    setDragging(true);
    dragOffset.current = {
      x: e.clientX - x,
      y: e.clientY - y,
    };
    e.stopPropagation();
  };

  const onMouseMove = (e) => {
    if (!dragging || resizing) return;
    onDrag(id, e.movementX, e.movementY);
  };

  const onMouseUp = () => setDragging(false);

  useEffect(() => {
    if (dragging && !resizing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
    }
  });

  // Connection drag handlers
  const handleCircleDrag = (e) => {
    if (resizing || showDropdown) return; // Don't start connecting while resizing or dropdown is open
    onStartConnect({ id, x, y, text, color, width, height, images }, e.currentTarget, e);
    e.stopPropagation();
    e.preventDefault();
  };

  // Resize handlers
  const handleResizeStart = (e) => {
    console.log('Starting resize for note:', id);
    setResizing(true);
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = width;
    const startHeight = height;

    const handleResizeMove = (moveEvent) => {
      const newWidth = Math.max(100, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(60, startHeight + (moveEvent.clientY - startY));
      console.log('Resizing to:', newWidth, newHeight);
      onResize(id, newWidth, newHeight);
    };

    const handleResizeEnd = (endEvent) => {
      console.log('Ending resize');
      setResizing(false);
      endEvent.stopPropagation(); // Prevent any propagation on mouseup
      endEvent.preventDefault();
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  };

  // Handle menu button click
  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  return (
    <div
      ref={divRef}
      style={{
        position: "absolute",
        top: y,
        left: x,
        width: width,
        minHeight: height,
        boxShadow: "2px 2px 8px #ccc",
        borderRadius: 6,
        background: color,
        padding: 0,
        zIndex: dragging || resizing ? 5 : 1,
        userSelect: "none",
        border: isNearby ? "2px solid #ff6b35" : "none",
      }}
      data-noteid={id}
    >
      <div
        style={{
          background: "rgba(0,0,0,0.05)",
          cursor: "grab",
          padding: 5,
          borderTopLeftRadius: 6,
          borderTopRightRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
        onMouseDown={onMouseDown}
      >
        <button
          onClick={handleMenuClick}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            userSelect: "none",
            fontSize: "16px",
            padding: "0 2px",
          }}
          aria-label="Menu"
          title="Attach image"
        >
          🟰
        </button>
        
        {/* Dropdown Menu */}
        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              background: "white",
              border: "1px solid #ccc",
              borderRadius: 4,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000,
              minWidth: 120,
              padding: 4,
            }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "6px 10px",
                border: "none",
                background: "none",
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 2,
                fontSize: 14,
              }}
              onMouseEnter={(e) => e.target.style.background = "#f0f0f0"}
              onMouseLeave={(e) => e.target.style.background = "none"}
            >
              📎 Attach Image
            </button>
            {images && images.length > 0 && (
              <button
                onClick={() => {
                  // Remove all images
                  for (let i = images.length - 1; i >= 0; i--) {
                    onImageRemove(i);
                  }
                  setShowDropdown(false);
                }}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: 2,
                  fontSize: 14,
                  color: "#d63384",
                }}
                onMouseEnter={(e) => e.target.style.background = "#f0f0f0"}
                onMouseLeave={(e) => e.target.style.background = "none"}
              >
                🗑️ Remove All Images
              </button>
            )}
          </div>
        )}
        
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Connection Circle */}
          <div
            onMouseDown={handleCircleDrag}
            data-noteid={id}
            title="Connect to another note"
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: isNearby ? "#ff6b35" : "#666",
              cursor: "pointer",
              userSelect: "none",
              transition: "all 0.2s ease",
              border: "2px solid white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }}
          />
          
          <button
            onClick={() => onDelete(id)}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              color: "#b28",
              cursor: "pointer",
              userSelect: "none",
              padding: "0 2px",
            }}
            aria-label="Delete note"
          >
            ×
          </button>
        </div>
      </div>
      {/* Content Area */}
      <div style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Images Display */}
        {images && images.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {images.map((imageData, index) => (
              <div key={index} style={{ position: "relative", textAlign: "center", overflow: "hidden" }}>
                <img
                  src={imageData}
                  alt={`Attached ${index + 1}`}
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: 4,
                    objectFit: "contain",
                    border: "1px solid rgba(0,0,0,0.1)",
                    maxWidth: width - 20, // Account for padding
                    display: "block",
                  }}
                />
                {/* Individual image delete button */}
                <button
                  onClick={() => onImageRemove(index)}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    background: "rgba(255,255,255,0.9)",
                    border: "none",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#d63384",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }}
                  title="Remove this image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Text Area */}
        <textarea
          ref={textareaRef}
          style={{
            background: "transparent",
            border: "none",
            resize: "none",
            width: "100%",
            minHeight: images && images.length > 0 ? 40 : Math.max(40, height - 50), // Smaller text area when images present
            fontSize: 15,
            outline: "none",
            fontFamily: "inherit",
            flex: images && images.length > 0 ? "0 0 auto" : "1",
          }}
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={images && images.length > 0 ? "Add a caption..." : "Type note or paste image..."}
        />
      </div>
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      
      {/* Resize handle */}
      <div
        data-resize-handle="true"
        onMouseDown={handleResizeStart}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        style={{
          position: "absolute",
          bottom: 0,
          right: 0,
          width: 16,
          height: 16,
          cursor: "nw-resize",
          background: "rgba(0,0,0,0.2)",
          borderTopLeftRadius: 6,
          borderBottomRightRadius: 6,
          userSelect: "none",
          zIndex: 10,
        }}
        title="Drag to resize"
      >
        <div style={{
          position: "absolute",
          bottom: 2,
          right: 2,
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderBottom: "6px solid rgba(0,0,0,0.4)",
        }} />
      </div>
    </div>
  );
}