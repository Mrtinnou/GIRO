from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from datetime import datetime
import os
import json

app = FastAPI(title="GIRO® - API de Contenedores Inteligentes")

# Configurar CORS para permitir conexiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de la base de datos PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        return conn
    except Exception as e:
        print(f"Error conectando a la base de datos: {e}")
        raise HTTPException(status_code=500, detail="Error de conexión a la base de datos")

class DatosContenedor(BaseModel):
    temperatura: float
    humedad: float
    nivel: float

@app.get("/")
def root():
    return {"message": "GIRO® - API de Contenedores Inteligentes - Universidad Gabriela Mistral"}

@app.post("/api/contenedor/{id}")
def registrar_datos(id: int, datos: DatosContenedor):
    """Endpoint para recibir datos de los módulos ESP8266"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Insertar datos en PostgreSQL
        cursor.execute(
            "INSERT INTO contenedores (contenedor, temperatura, humedad, nivel) VALUES (%s, %s, %s, %s)",
            (id, datos.temperatura, datos.humedad, datos.nivel)
        )
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"Datos recibidos del contenedor {id}: T={datos.temperatura}°C, H={datos.humedad}%, N={datos.nivel}cm")
        
        return {
            "status": "ok",
            "contenedor": id,
            "mensaje": f"Datos del contenedor {id} registrados correctamente"
        }
        
    except Exception as e:
        print(f"Error registrando datos: {e}")
        raise HTTPException(status_code=500, detail=f"Error al registrar datos: {str(e)}")

@app.get("/api/contenedores")
def obtener_datos():
    """Endpoint para obtener todos los datos de contenedores para el frontend"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Obtener los datos más recientes de cada contenedor
        cursor.execute("""
            SELECT DISTINCT ON (contenedor) 
                   contenedor, temperatura, humedad, nivel, fecha
            FROM contenedores
            ORDER BY contenedor, fecha DESC
        """)
        
        filas = cursor.fetchall()
        cursor.close()
        conn.close()
        
        salida = []
        for f in filas:
            # Calcular nivel de llenado basado en distancia del sensor ultrasónico
            # Asumiendo contenedor de 30cm de altura, invertir la medición
            altura_contenedor = 30  # cm
            distancia_medida = f[3]  # cm desde el sensor al contenido
            nivel_llenado = max(0, min(100, ((altura_contenedor - distancia_medida) / altura_contenedor) * 100))
            
            # Determinar estado
            estado = "Bajo"
            if nivel_llenado > 70: 
                estado = "Alto"
            elif nivel_llenado > 30: 
                estado = "Medio"
            
            salida.append({
                "id": f"CONT{f[0]:03d}",  # Formato CONT001, CONT002, etc.
                "contenedor": f[0],
                "temperatura": round(f[1], 1),
                "humedad": round(f[2], 1),
                "nivel_distancia": round(f[3], 1),  # Distancia original del sensor
                "nivel_llenado": round(nivel_llenado, 0),  # Nivel calculado en %
                "estado": estado,
                "timestamp": f[4].strftime("%Y-%m-%d %H:%M:%S"),
                "lat": -33.4489 + (f[0] * 0.001),  # Coordenadas simuladas para Santiago
                "lng": -70.6693 + (f[0] * 0.001)   # Distribución espacial básica
            })
        
        return salida
        
    except Exception as e:
        print(f"Error obteniendo datos: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener datos: {str(e)}")

@app.get("/api/contenedores/historia/{contenedor_id}")
def obtener_historia(contenedor_id: int, limit: int = 100):
    """Obtener el historial de un contenedor específico"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT temperatura, humedad, nivel, fecha
            FROM contenedores
            WHERE contenedor = %s
            ORDER BY fecha DESC
            LIMIT %s
        """, (contenedor_id, limit))
        
        filas = cursor.fetchall()
        cursor.close()
        conn.close()
        
        historia = []
        for f in filas:
            altura_contenedor = 30
            distancia_medida = f[2]
            nivel_llenado = max(0, min(100, ((altura_contenedor - distancia_medida) / altura_contenedor) * 100))
            
            historia.append({
                "temperatura": round(f[0], 1),
                "humedad": round(f[1], 1),
                "nivel_distancia": round(f[2], 1),
                "nivel_llenado": round(nivel_llenado, 0),
                "fecha": f[3].strftime("%Y-%m-%d %H:%M:%S")
            })
        
        return {
            "contenedor": contenedor_id,
            "total_registros": len(historia),
            "historia": historia
        }
        
    except Exception as e:
        print(f"Error obteniendo historia: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener historia: {str(e)}")

@app.get("/api/estadisticas")
def obtener_estadisticas():
    """Obtener estadísticas generales del sistema"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Contar contenedores activos
        cursor.execute("SELECT COUNT(DISTINCT contenedor) FROM contenedores")
        result = cursor.fetchone()
        total_contenedores = result[0] if result else 0
        
        # Obtener datos recientes para estadísticas
        cursor.execute("""
            SELECT DISTINCT ON (contenedor) 
                   contenedor, temperatura, humedad, nivel
            FROM contenedores
            ORDER BY contenedor, fecha DESC
        """)
        
        datos_recientes = cursor.fetchall()
        cursor.close()
        conn.close()
        
        criticos = 0
        medios = 0
        bajos = 0
        
        for dato in datos_recientes:
            altura_contenedor = 30
            nivel_llenado = max(0, min(100, ((altura_contenedor - dato[3]) / altura_contenedor) * 100))
            
            if nivel_llenado > 70:
                criticos += 1
            elif nivel_llenado > 30:
                medios += 1
            else:
                bajos += 1
        
        return {
            "total_contenedores": total_contenedores,
            "contenedores_criticos": criticos,
            "contenedores_medios": medios,
            "contenedores_bajos": bajos,
            "ultima_actualizacion": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
    except Exception as e:
        print(f"Error obteniendo estadísticas: {e}")
        raise HTTPException(status_code=500, detail=f"Error al obtener estadísticas: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando GIRO® API Server...")
    print("📊 Base de datos PostgreSQL configurada")
    print("📡 Listo para recibir datos de ESP8266")
    uvicorn.run(app, host="0.0.0.0", port=8000)